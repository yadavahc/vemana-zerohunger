/**
 * Dispatch Agent — finds nearest available volunteer,
 * assigns the delivery, and monitors ETA.
 */

import { Timestamp } from "firebase/firestore";
import {
  createDelivery,
  updateMatch,
  updateRequest,
  getOpenDeliveries,
  updateDelivery,
  createNotification,
  logAgentDecision,
  getRequestById,
} from "@/lib/firebase/db";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/db";
import type { Match, Delivery } from "@/lib/types";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function runDispatchAgent(match: Match): Promise<string | null> {
  await logAgentDecision("dispatch", "start_dispatch", { matchId: match.id });

  // Get listing and request details
  const { getDoc, doc } = await import("firebase/firestore");
  const [listingSnap, requestSnap] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.LISTINGS, match.listingId)),
    getDoc(doc(db, COLLECTIONS.REQUESTS, match.requestId)),
  ]);

  if (!listingSnap.exists() || !requestSnap.exists()) return null;

  const listing = listingSnap.data();
  const request = requestSnap.data();

  // Create delivery record
  const deliveryId = await createDelivery({
    matchId: match.id,
    requestId: match.requestId,
    listingId: match.listingId,
    pickupAddress: listing.address,
    dropAddress: request.address,
    status: "finding_volunteer",
  });

  await updateMatch(match.id, { status: "dispatched" });
  await updateRequest(match.requestId, { status: "dispatched" });

  // Broadcast to all volunteers (open delivery)
  await createNotification({
    userId: "broadcast_volunteer",
    title: "New pickup available!",
    body: `Pickup: ${listing.address} → Drop: ${request.address}`,
    type: "dispatch",
    read: false,
    metadata: { deliveryId, matchId: match.id },
  });

  await logAgentDecision("dispatch", "delivery_created", { deliveryId, matchId: match.id });

  return deliveryId;
}

export async function assignVolunteer(
  deliveryId: string,
  volunteerId: string,
  volunteerName: string,
  volunteerPhone: string
) {
  const { getDoc, doc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, COLLECTIONS.DELIVERIES, deliveryId));
  const delivery = snap.exists() ? snap.data() as Delivery : null;

  await updateDelivery(deliveryId, {
    volunteerId,
    volunteerName,
    volunteerPhone,
    status: "assigned",
    estimatedETA: 30,
  });

  // WhatsApp to volunteer with pickup details
  if (delivery) {
    sendWhatsApp(
      volunteerPhone,
      `🚴 Prasadam Delivery Assigned!\nPickup: ${delivery.pickupAddress}\nDrop: ${delivery.dropAddress}\nPlease open the app to confirm and start. Dhanyavaad 🙏`
    ).catch(() => {});
  }

  await logAgentDecision("dispatch", "volunteer_assigned", { deliveryId, volunteerId });
}

export async function updateDeliveryProgress(
  deliveryId: string,
  status: Delivery["status"],
  extras?: Partial<Delivery>
) {
  await updateDelivery(deliveryId, { status, ...extras });

  if (status === "delivered") {
    // Get delivery to update match and request
    const { getDoc, doc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, COLLECTIONS.DELIVERIES, deliveryId));
    if (!snap.exists()) return;
    const delivery = snap.data() as Delivery;

    await Promise.all([
      updateMatch(delivery.matchId, { status: "completed" }),
      updateRequest(delivery.requestId, { status: "delivered" }),
    ]);

    // Import and update listing
    const { updateListing } = await import("@/lib/firebase/db");
    await updateListing(delivery.listingId, { status: "collected" });

    // WhatsApp to NGO on successful delivery
    const request = await getRequestById(delivery.requestId);
    if (request?.ngoPhone) {
      sendWhatsApp(
        request.ngoPhone,
        `🎉 Prasadam Delivered! ${request.servingsNeeded} servings${request.approvedByRestaurant ? ` from ${request.approvedByRestaurant}` : ""} have been received. Blessed food distributed. 🙏`
      ).catch(() => {});
    }

    await createNotification({
      userId: delivery.requestId,
      title: "Delivery complete!",
      body: `Your food has been delivered successfully.`,
      type: "delivery",
      read: false,
      metadata: { deliveryId },
    });

    await logAgentDecision("dispatch", "delivery_completed", { deliveryId });
  }
}
