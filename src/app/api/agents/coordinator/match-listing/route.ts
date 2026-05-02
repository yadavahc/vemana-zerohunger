/**
 * Called after a donor creates a new listing.
 * Finds the highest-priority pending NGO request and runs the coordinator
 * to auto-match it against the new listing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPendingRequests } from "@/lib/firebase/db";
import { runCoordinatorAgent } from "@/lib/agents/coordinator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { listingId } = await req.json() as { listingId: string };
    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }

    // Find the top pending request (sorted by priority desc in getPendingRequests)
    const pending = await getPendingRequests();
    if (pending.length === 0) {
      return NextResponse.json({ matched: false, reason: "no_pending_requests" });
    }

    // Run coordinator for the highest-priority request
    const topRequest = pending[0];
    const matchId = await runCoordinatorAgent(topRequest);

    return NextResponse.json({ matched: !!matchId, matchId: matchId ?? null, requestId: topRequest.id });
  } catch (error) {
    console.error("[match-listing]", error);
    return NextResponse.json({ error: "Failed to match" }, { status: 500 });
  }
}
