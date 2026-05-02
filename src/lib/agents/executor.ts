/**
 * Executes tool calls returned by OpenAI agents.
 * Maps tool names → real Firestore operations.
 */

import { Timestamp } from "firebase/firestore";
import {
  getAvailableListings,
  getPendingRequests,
  getOpenDeliveries,
  createMatch,
  createEscalation,
  createNotification,
  logAgentDecision,
  updateRequest,
  updateListing,
  updateDelivery,
  getMatchById,
  COLLECTIONS,
} from "@/lib/firebase/db";
import { db } from "@/lib/firebase/config";

const SLA_MINUTES = 5;

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_available_listings":
      return getAvailableListings();

    case "get_pending_requests":
      return getPendingRequests();

    case "get_open_deliveries":
      return getOpenDeliveries();

    case "create_match": {
      const { requestId, listingId, reasoning } = args as {
        requestId: string;
        listingId: string;
        reasoning: string;
      };

      const { getDoc, doc } = await import("firebase/firestore");
      const [reqSnap, listSnap] = await Promise.all([
        getDoc(doc(db, COLLECTIONS.REQUESTS, requestId)),
        getDoc(doc(db, COLLECTIONS.LISTINGS, listingId)),
      ]);

      if (!reqSnap.exists() || !listSnap.exists()) {
        return { error: "Request or listing not found" };
      }

      const request = reqSnap.data();
      const listing = listSnap.data();

      const slaDeadline = Timestamp.fromDate(
        new Date(Date.now() + SLA_MINUTES * 60 * 1000)
      );

      const matchId = await createMatch({
        requestId,
        listingId,
        ngoId: request.ngoId,
        ngoName: request.ngoName,
        restaurantId: listing.restaurantId,
        restaurantName: listing.restaurantName,
        status: "pending_approval",
        slaDeadline,
      });

      await Promise.all([
        updateListing(listingId, { status: "pending" }),
        updateRequest(requestId, { status: "matched" }),
      ]);

      // Notify restaurant
      await createNotification({
        userId: listing.restaurantId,
        title: "Food request matched! 🙏",
        body: `${request.ngoName} needs ${request.servingsNeeded} servings. Approve within ${SLA_MINUTES} min.`,
        type: "match",
        read: false,
        metadata: { matchId, requestId, listingId },
      });

      // Notify NGO
      await createNotification({
        userId: request.ngoId,
        title: "Match found!",
        body: `${listing.restaurantName} has surplus for you. Awaiting their approval.`,
        type: "match",
        read: false,
        metadata: { matchId },
      });

      await logAgentDecision("coordinator", "match_created", {
        matchId,
        requestId,
        listingId,
        reasoning,
      });

      return { matchId, status: "pending_approval" };
    }

    case "assign_volunteer": {
      const { deliveryId, volunteerId, reasoning } = args as {
        deliveryId: string;
        volunteerId: string;
        reasoning: string;
      };

      const { getDoc, doc } = await import("firebase/firestore");
      const [deliverySnap, volunteerSnap] = await Promise.all([
        getDoc(doc(db, COLLECTIONS.DELIVERIES, deliveryId)),
        getDoc(doc(db, COLLECTIONS.USERS, volunteerId)),
      ]);

      if (!deliverySnap.exists() || !volunteerSnap.exists()) {
        return { error: "Delivery or volunteer not found" };
      }

      const volunteer = volunteerSnap.data();

      await updateDelivery(deliveryId, {
        volunteerId,
        volunteerName: volunteer.name,
        volunteerPhone: volunteer.phone,
        status: "assigned",
        estimatedETA: 30,
      });

      await createNotification({
        userId: volunteerId,
        title: "New delivery assigned!",
        body: `You have a new Prasadam delivery. Check your dashboard.`,
        type: "dispatch",
        read: false,
        metadata: { deliveryId },
      });

      await logAgentDecision("dispatch", "volunteer_assigned", {
        deliveryId,
        volunteerId,
        reasoning,
      });

      return { status: "assigned", volunteerId };
    }

    case "create_escalation": {
      const { type, strategy, context } = args as {
        type: string;
        strategy: string;
        context: Record<string, unknown>;
      };

      const escalationId = await createEscalation({
        type: type as Parameters<typeof createEscalation>[0]["type"],
        status: "open",
        attempts: 1,
        context: { ...context, aiStrategy: strategy },
        matchId: context.matchId as string | undefined,
        deliveryId: context.deliveryId as string | undefined,
      });

      await createNotification({
        userId: "admin",
        title: `Escalation: ${type.replace(/_/g, " ")}`,
        body: strategy,
        type: "escalation",
        read: false,
        metadata: { escalationId, ...context },
      });

      return { escalationId };
    }

    case "send_notification": {
      const { userId, title, body, type, metadata } = args as {
        userId: string;
        title: string;
        body: string;
        type: Parameters<typeof createNotification>[0]["type"];
        metadata?: Record<string, unknown>;
      };

      const notifId = await createNotification({
        userId,
        title,
        body,
        type,
        read: false,
        metadata,
      });

      return { notifId };
    }

    case "log_decision": {
      const { agent, action, reasoning, context } = args as {
        agent: string;
        action: string;
        reasoning: string;
        context?: Record<string, unknown>;
      };

      await logAgentDecision(agent, action, { reasoning, ...context });
      return { logged: true };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
