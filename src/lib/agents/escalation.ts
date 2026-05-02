/**
 * Escalation Agent — handles failures at every step.
 * Watches SLA timers, escalates to admin only as last resort.
 */

import {
  createEscalation,
  updateEscalation,
  updateMatch,
  updateListing,
  updateRequest,
  createNotification,
  logAgentDecision,
  getOpenEscalations,
} from "@/lib/firebase/db";
import type { EscalationType, FoodRequest } from "@/lib/types";

export async function runEscalationAgent(
  type: EscalationType,
  context: Record<string, unknown>
): Promise<void> {
  const escalationId = await createEscalation({
    type,
    status: "open",
    attempts: 1,
    context,
    matchId: context.matchId as string | undefined,
    deliveryId: context.deliveryId as string | undefined,
  });

  await logAgentDecision("escalation", "escalation_created", { escalationId, type });

  switch (type) {
    case "no_restaurant_response":
      await handleNoRestaurantResponse(escalationId, context);
      break;
    case "volunteer_no_show":
      await handleVolunteerNoShow(escalationId, context);
      break;
    case "food_expiring":
      await handleFoodExpiring(escalationId, context);
      break;
    case "quality_fail":
      await handleQualityFail(escalationId, context);
      break;
  }
}

async function handleNoRestaurantResponse(
  escalationId: string,
  context: Record<string, unknown>
) {
  const request = context.request as FoodRequest;

  // Re-queue request to find another supply
  await updateRequest(request.id, { status: "pending" });

  // Notify admin
  await createNotification({
    userId: "admin",
    title: "Restaurant didn't respond",
    body: `Match for ${request.ngoName}'s request has no response. Re-queued for next supply match.`,
    type: "escalation",
    read: false,
    metadata: { escalationId, requestId: request.id },
  });

  await updateEscalation(escalationId, { status: "escalated_to_admin", attempts: 2 });

  await logAgentDecision("escalation", "no_response_requeued", {
    escalationId,
    requestId: request.id,
  });
}

async function handleVolunteerNoShow(
  escalationId: string,
  context: Record<string, unknown>
) {
  const deliveryId = context.deliveryId as string;

  // Reset to finding_volunteer
  const { updateDelivery } = await import("@/lib/firebase/db");
  await updateDelivery(deliveryId, {
    volunteerId: undefined,
    volunteerName: undefined,
    status: "finding_volunteer",
  });

  await createNotification({
    userId: "admin",
    title: "Volunteer no-show",
    body: `Volunteer didn't pick up delivery ${deliveryId}. Reassigning.`,
    type: "escalation",
    read: false,
    metadata: { escalationId, deliveryId },
  });

  await updateEscalation(escalationId, { status: "escalated_to_admin", attempts: 2 });
}

async function handleFoodExpiring(escalationId: string, context: Record<string, unknown>) {
  const listingId = context.listingId as string;
  const restaurantId = context.restaurantId as string;

  await createNotification({
    userId: restaurantId,
    title: "Food expiring soon!",
    body: "Your surplus food listing is expiring in 1 hour. Please update or it will be auto-removed.",
    type: "alert",
    read: false,
    metadata: { escalationId, listingId },
  });

  await updateEscalation(escalationId, { status: "open", attempts: 2 });
}

async function handleQualityFail(escalationId: string, context: Record<string, unknown>) {
  const deliveryId = context.deliveryId as string;

  await createNotification({
    userId: "admin",
    title: "Quality check failed",
    body: `Food quality issue flagged for delivery ${deliveryId}. Review required.`,
    type: "escalation",
    read: false,
    metadata: { escalationId, deliveryId },
  });

  await updateEscalation(escalationId, { status: "escalated_to_admin", attempts: 1 });
}
