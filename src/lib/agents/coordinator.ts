/**
 * Enhanced Coordinator Agent — Multi-agent orchestration
 * - Routes requests to appropriate agents
 * - Manages agent-to-agent message bus
 * - Handles timeouts and escalation
 * - Maintains complete audit trail
 */

import { Timestamp } from "firebase/firestore";
import {
  createMatch,
  updateRequest,
  updateListing,
  logAgentDecision,
  createNotification,
  getRequestById,
  getUser,
} from "@/lib/firebase/db";
import type { FoodRequest, FoodListing, Match } from "@/lib/types";
import { runSupplyAgent, findBestSupplyMatch, pingRestaurantManagerForUrgent, monitorInventoryExpiryAlerts } from "./supply";
import { rankPendingRequests, sendConfirmationToNGO } from "./demand";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendEmail, buildMatchFoundEmail, buildApprovalEmail } from "@/lib/email";

// Constants
const SLA_MINUTES = 5;
const ESCALATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Agent Message Bus - Routes messages between agents
 */
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: Timestamp;
  processed: boolean;
}

class AgentMessageBus {
  private messages: Map<string, AgentMessage> = new Map();

  async send(from: string, to: string, type: string, payload: any): Promise<string> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: AgentMessage = {
      id,
      from,
      to,
      type,
      payload,
      timestamp: Timestamp.now(),
      processed: false,
    };

    this.messages.set(id, message);

    // Log message
    await logAgentDecision("message_bus", "message_sent", {
      messageId: id,
      from,
      to,
      type,
    });

    return id;
  }

  async receive(to: string, type?: string): Promise<AgentMessage[]> {
    const messages = Array.from(this.messages.values()).filter(
      (m) => m.to === to && !m.processed && (!type || m.type === type)
    );
    return messages;
  }

  async markProcessed(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (message) {
      message.processed = true;
    }
  }
}

const messageBus = new AgentMessageBus();

/**
 * Main Coordinator Agent - Orchestrate all agents
 */
export async function runCoordinatorAgent(request: FoodRequest): Promise<string | null> {
  const auditTrail: any[] = [];

  try {
    // 1. Log request received
    const startTime = Date.now();
    await logAgentDecision("coordinator", "receive_request", {
      requestId: request.id,
      ngoId: request.ngoId,
      servingsNeeded: request.servingsNeeded,
      urgency: request.urgency,
      timestamp: new Date().toISOString(),
    });
    auditTrail.push({ step: "request_received", time: Date.now() - startTime });

    // 2. Activate Supply Agent
    await messageBus.send("coordinator", "supply", "find_match", {
      requestId: request.id,
      request,
    });

    const supplyMatch = await findBestSupplyMatch(request);
    auditTrail.push({ step: "supply_agent_executed", time: Date.now() - startTime });

    if (!supplyMatch) {
      // No supply found - escalate
      await handleNoSupply(request, auditTrail);
      return null;
    }

    // 3. For urgent requests, ping restaurant immediately
    if (request.urgency === "critical" || request.urgency === "high") {
      await pingRestaurantManagerForUrgent(supplyMatch.listing, request);
      auditTrail.push({ step: "urgent_ping_sent", time: Date.now() - startTime });
    }

    // 4. Create Match document
    const match = await createMatchWithAudit(request, supplyMatch.listing, auditTrail);
    const matchId = match.id;

    // 5. Send match confirmation to NGO
    await sendConfirmationToNGO(
      request.ngoId,
      request.id,
      `✨ We found a match! ${supplyMatch.listing.restaurantName} has ${supplyMatch.listing.totalServings} servings. Waiting for their approval.`
    );

    // 6. Notify restaurant (in-app + WhatsApp)
    await createNotification({
      userId: supplyMatch.listing.restaurantId,
      title: "🍽️ Food Request Matched!",
      body: `${request.ngoName} needs ${request.servingsNeeded} servings for ${request.beneficiaryCount} people. (Urgency: ${request.urgency})`,
      type: "match",
      read: false,
      metadata: { matchId, requestId: request.id },
    });

    await sendWhatsApp(
      supplyMatch.listing.restaurantPhone,
      `🙏 Prasadam: ${request.ngoName} needs ${request.servingsNeeded} servings for ${request.beneficiaryCount} people. Please approve within ${SLA_MINUTES} minutes to help!`
    ).catch(() => {});

    // Email NGO: match found, waiting for restaurant approval
    const ngoUser = await getUser(request.ngoId);
    if (ngoUser?.email) {
      sendEmail({
        to: ngoUser.email,
        subject: `✨ Match Found for Your Food Request — Prasadam`,
        html: buildMatchFoundEmail({
          ngoName: request.ngoName,
          restaurantName: supplyMatch.listing.restaurantName,
          servingsAvailable: supplyMatch.listing.totalServings,
        }),
      }).catch(() => {});
    }

    auditTrail.push({ step: "notifications_sent", time: Date.now() - startTime });

    // 7. Set up timeout and escalation
    setupTimeoutEscalation(matchId, request, supplyMatch.listing);

    // 8. Log complete audit trail
    await logAgentDecision("coordinator", "match_created", {
      matchId,
      requestId: request.id,
      listingId: supplyMatch.listing.id,
      auditTrail,
      totalTime: Date.now() - startTime,
    });

    console.log(`[Coordinator] Match created: ${matchId} (${Date.now() - startTime}ms)`);
    return matchId;
  } catch (error) {
    console.error("[Coordinator] Error:", error);
    await logAgentDecision("coordinator", "error", {
      error: error instanceof Error ? error.message : String(error),
      requestId: request.id,
      auditTrail,
    });
    return null;
  }
}

/**
 * Handle restaurant approval
 */
export async function handleRestaurantApproval(
  matchId: string,
  approved: boolean,
  restaurantId: string,
  reason?: string
): Promise<void> {
  const auditTrail: any[] = [];
  const startTime = Date.now();

  try {
    const { getMatchById, updateMatch } = await import("@/lib/firebase/db");
    const match = await getMatchById(matchId);

    if (!match) {
      console.error(`[Coordinator] Match not found: ${matchId}`);
      return;
    }

    await logAgentDecision("coordinator", "approval_received", {
      matchId,
      approved,
      restaurantId,
      reason,
    });

    if (!approved) {
      // Rejection - unlock and re-queue
      await updateMatch(matchId, {
        status: "rejected",
        rejectionReason: reason,
      });

      await updateRequest(match.requestId, { status: "pending" });
      await updateListing(match.listingId, { status: "available" });

      auditTrail.push({ step: "match_rejected", reason, time: Date.now() - startTime });

      // Trigger escalation to find next match
      const { runEscalationAgent } = await import("./escalation");
      const request = await getRequestById(match.requestId);
      if (request) {
        await runEscalationAgent("no_restaurant_response", { matchId, request });
      }

      await logAgentDecision("coordinator", "rejection_escalated", {
        matchId,
        auditTrail,
      });
      return;
    }

    // Approval - proceed with dispatch
    await updateMatch(matchId, {
      status: "approved",
      restaurantApprovalTime: Timestamp.now(),
    });

    await updateRequest(match.requestId, {
      status: "approved",
      approvedByRestaurant: match.restaurantName,
    });

    auditTrail.push({ step: "match_approved", time: Date.now() - startTime });

    // Notify NGO (in-app + WhatsApp + email)
    const request = await getRequestById(match.requestId);
    if (request) {
      await sendConfirmationToNGO(
        request.ngoId,
        request.id,
        `✅ Approved by ${match.restaurantName}! A volunteer is being assigned to deliver your food now.`
      );

      // Email NGO on approval
      const ngoUser = await getUser(request.ngoId);
      if (ngoUser?.email) {
        sendEmail({
          to: ngoUser.email,
          subject: `✅ Your Food Request is Approved! — Prasadam`,
          html: buildApprovalEmail({
            ngoName: request.ngoName,
            restaurantName: match.restaurantName,
            servingsNeeded: request.servingsNeeded,
            pickupAddress: request.address,
            matchId,
          }),
        }).catch(() => {});
      }
    }

    // Trigger Dispatch Agent
    const { runDispatchAgent } = await import("./dispatch");
    await runDispatchAgent(match);

    auditTrail.push({ step: "dispatch_triggered", time: Date.now() - startTime });

    await logAgentDecision("coordinator", "approval_processed", {
      matchId,
      auditTrail,
      totalTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[Coordinator] Approval error:", error);
    await logAgentDecision("coordinator", "approval_error", {
      matchId,
      error: error instanceof Error ? error.message : String(error),
      auditTrail,
    });
  }
}

/**
 * Handle no supply scenario
 */
async function handleNoSupply(request: FoodRequest, auditTrail: any[]): Promise<void> {
  const startTime = Date.now();

  await updateRequest(request.id, {
    status: "pending",
  });

  await sendConfirmationToNGO(
    request.ngoId,
    request.id,
    `⏳ We're searching for food sources for you. This may take a few minutes. We'll notify you as soon as we find a match!`
  );

  // Trigger escalation
  const { runEscalationAgent } = await import("./escalation");
  await runEscalationAgent("no_restaurant_response", {
    requestId: request.id,
    request,
  });

  auditTrail.push({ step: "escalated_no_supply", time: Date.now() - startTime });

  await logAgentDecision("coordinator", "no_supply_found", {
    requestId: request.id,
    auditTrail,
  });
}

/**
 * Create match with audit trail
 */
async function createMatchWithAudit(
  request: FoodRequest,
  listing: FoodListing,
  auditTrail: any[]
): Promise<any> {
  const startTime = Date.now();

  const slaDeadline = Timestamp.fromDate(new Date(Date.now() + SLA_MINUTES * 60 * 1000));

  const matchId = await createMatch({
    requestId: request.id,
    listingId: listing.id,
    ngoId: request.ngoId,
    ngoName: request.ngoName,
    restaurantId: listing.restaurantId,
    restaurantName: listing.restaurantName,
    status: "pending_approval",
    slaDeadline,
  });

  await Promise.all([
    updateListing(listing.id, { status: "pending" }),
    updateRequest(request.id, { status: "matched" }),
  ]);

  auditTrail.push({ step: "match_created_in_firestore", matchId, time: Date.now() - startTime });

  return { id: matchId };
}

/**
 * Setup timeout and escalation for SLA breach
 * Note: Uses Firestore deadline for reliable monitoring via scheduled cron job
 */
function setupTimeoutEscalation(
  matchId: string,
  request: FoodRequest,
  listing: FoodListing
): void {
  // SLA deadline is already stored in match document via slaDeadline field
  // Monitoring handled by /api/cron/sla-monitor endpoint called by Cloud Scheduler
  console.log(`[Coordinator] SLA monitoring setup for match ${matchId}, deadline: 5 minutes`);
}

// Export message bus for other agents
export { messageBus };
export type { AgentMessage };
