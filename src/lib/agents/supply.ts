/**
 * Supply Agent — Real-time inventory monitoring & matching
 * Monitors food listings, tracks expiry with auto-alerts
 * Matches NGO needs to nearest surplus
 * Pings restaurant managers for urgent requests
 */

import { Timestamp } from "firebase/firestore";
import {
  getAvailableListings,
  logAgentDecision,
  createNotification,
  updateListing,
  getUser,
} from "@/lib/firebase/db";
import type { FoodListing, FoodRequest, ListingStatus } from "@/lib/types";
import { sendWhatsApp } from "@/lib/whatsapp";

interface SupplyMatch {
  listing: FoodListing;
  score: number;
  distance: number;
  urgencyFit: number;
  freshnessFit: number;
  expiryHours: number;
}

/**
 * Find best supply match for NGO request
 * Considers: servings, expiry, distance, freshness
 */
export async function findBestSupplyMatch(request: FoodRequest): Promise<SupplyMatch | null> {
  const listings = await getAvailableListings();
  const now = Date.now();

  // Filter eligible listings
  const eligible = listings.filter((l) => {
    const notExpired = l.expiryTime.toDate().getTime() > now;
    const sufficientServings = l.totalServings >= request.servingsNeeded * 0.8;
    return notExpired && sufficientServings;
  });

  if (eligible.length === 0) return null;

  // Score each match
  const matches = eligible.map((listing) => {
    // Expiry score - prefer items expiring soon but not urgent
    const msUntilExpiry = listing.expiryTime.toDate().getTime() - now;
    const expiryHours = msUntilExpiry / (1000 * 60 * 60);
    const freshnessFit =
      expiryHours < 0.5 ? 0.2 :      // Less than 30 min - very urgent
      expiryHours < 1 ? 0.6 :        // 30min-1hr - urgent
      expiryHours <= 4 ? 1.0 :       // 1-4 hrs - ideal
      expiryHours <= 8 ? 0.8 :       // 4-8 hrs - good
      0.5;                            // 8+ hrs - less critical

    // Servings fit score
    const servingsFit = Math.min(listing.totalServings / request.servingsNeeded, 1.2);

    // Distance score (0-1, closer = higher)
    const distance = calculateDistance(
      request.location?.latitude || 0,
      request.location?.longitude || 0,
      listing.location?.latitude || 0,
      listing.location?.longitude || 0
    );
    const maxDistance = 50; // km
    const distanceFit = Math.max(0, 1 - distance / maxDistance);

    // Urgency fit - critical needs get highest priority for fresh food
    const urgencyMap = { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 };
    const urgencyFit = (urgencyMap[request.urgency as keyof typeof urgencyMap] || 0.5) * 0.3;

    // Combined score
    const score =
      freshnessFit * 0.4 +      // Freshness is critical
      servingsFit * 0.3 +       // Serving quantity matters
      distanceFit * 0.2 +       // Geography matters
      urgencyFit * 0.1;         // Urgency weighting

    return {
      listing,
      score,
      distance,
      urgencyFit,
      freshnessFit,
      expiryHours,
    };
  });

  // Sort by score and return best match
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];

  if (best) {
    await logAgentDecision("supply", "match_found", {
      listingId: best.listing.id,
      score: best.score,
      distance: best.distance,
      expiryHours: best.expiryHours,
    });
  }

  return best || null;
}

/**
 * Real-time inventory monitoring with expiry alerts
 */
export async function monitorInventoryExpiryAlerts(): Promise<void> {
  const listings = await getAvailableListings();
  const now = Date.now();

  for (const listing of listings) {
    const msUntilExpiry = listing.expiryTime.toDate().getTime() - now;
    const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);

    // Alert thresholds
    if (hoursUntilExpiry < 0.5 && hoursUntilExpiry > 0) {
      // 30 minutes or less - URGENT
      await alertRestaurantManager(listing, "URGENT_EXPIRY", hoursUntilExpiry);
      await updateListing(listing.id, { status: "available" as ListingStatus });
    } else if (hoursUntilExpiry < 2 && hoursUntilExpiry >= 0.5) {
      // 30 min to 2 hours - HIGH PRIORITY
      await alertRestaurantManager(listing, "HIGH_PRIORITY_EXPIRY", hoursUntilExpiry);
      await updateListing(listing.id, { status: "available" as ListingStatus });
    } else if (hoursUntilExpiry < 4 && hoursUntilExpiry >= 2) {
      // 2-4 hours - MEDIUM PRIORITY
      await updateListing(listing.id, { status: "available" as ListingStatus });
    }

    // Log expiry monitoring
    if (hoursUntilExpiry < 4) {
      await logAgentDecision("supply", "expiry_alert", {
        listingId: listing.id,
        hoursUntilExpiry: Math.round(hoursUntilExpiry * 10) / 10,
        status: listing.status,
      });
    }
  }
}

/**
 * Ping restaurant manager for urgent requests
 */
export async function pingRestaurantManagerForUrgent(
  listing: FoodListing,
  request: FoodRequest
): Promise<void> {
  if (request.urgency !== "critical" && request.urgency !== "high") {
    return; // Only ping for urgent requests
  }

  const restaurant = await getUser(listing.restaurantId);
  if (!restaurant) return;

  const message = `🚨 URGENT: ${request.ngoName} needs ${request.servingsNeeded} servings ASAP for ${request.beneficiaryCount} people. Your surplus food can help! Please open the app immediately.`;

  // Send WhatsApp
  await sendWhatsApp(listing.restaurantPhone, message).catch(() => {});

  // Send in-app notification with priority flag
  await createNotification({
    userId: listing.restaurantId,
    title: "🚨 URGENT Food Request",
    body: `${request.ngoName} needs immediate assistance`,
    type: "match",
    read: false,
    metadata: {
      listingId: listing.id,
      requestId: request.id,
      urgency: request.urgency,
    },
  });

  await logAgentDecision("supply", "urgent_ping_sent", {
    listingId: listing.id,
    restaurantId: listing.restaurantId,
    requestId: request.id,
  });
}

/**
 * Alert restaurant manager about expiry
 */
async function alertRestaurantManager(
  listing: FoodListing,
  alertType: "URGENT_EXPIRY" | "HIGH_PRIORITY_EXPIRY",
  hoursRemaining: number
): Promise<void> {
  const restaurant = await getUser(listing.restaurantId);
  if (!restaurant) return;

  const message =
    alertType === "URGENT_EXPIRY"
      ? `⏰ URGENT: Your "${listing.foodItems?.[0]?.name || "food"}" expires in ${Math.round(hoursRemaining * 60)} minutes! We have urgent requests waiting. Don't waste food - approve now!`
      : `⚠️ Your "${listing.foodItems?.[0]?.name || "food"}" expires in ${Math.round(hoursRemaining)} hours. Requesting NGOs are waiting!`;

  // Send WhatsApp alert
  await sendWhatsApp(listing.restaurantPhone, message).catch(() => {});

  // Create notification
  await createNotification({
    userId: listing.restaurantId,
    title: "⏰ Food Expiry Alert",
    body: message,
    type: "alert",
    read: false,
    metadata: { listingId: listing.id },
  });
}

/**
 * Calculate distance between two coordinates (km)
 * Using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Legacy function for backward compatibility
 */
export async function runSupplyAgent(request: FoodRequest): Promise<FoodListing | null> {
  const match = await findBestSupplyMatch(request);
  return match?.listing || null;
}

export async function getPendingRequestById(requestId: string) {
  // Import here to avoid circular dependencies
  const { getRequestById } = await import("@/lib/firebase/db");
  return getRequestById(requestId);
}
