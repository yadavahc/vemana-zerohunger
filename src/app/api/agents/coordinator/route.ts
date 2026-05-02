import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { AGENT_TOOLS } from "@/lib/agents/tools";
import { executeTool } from "@/lib/agents/executor";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/db";
import type { FoodRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json();
    if (!requestId) return NextResponse.json({ error: "requestId required" }, { status: 400 });

    const snap = await getDoc(doc(db, COLLECTIONS.REQUESTS, requestId));
    if (!snap.exists()) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const request = { id: snap.id, ...snap.data() } as FoodRequest;

    const systemPrompt = `You are the Coordinator Agent for Prasadam, an AI-powered food redistribution platform in India.
Your job: match a food request from an NGO to the best available surplus food listing.

Rules:
- Always call get_available_listings first to see what's available
- Pick the listing with the most appropriate match: consider servings needed vs available, expiry time, and urgency
- Prefer listings expiring soonest (waste reduction) unless urgency is critical
- A listing needs at least 80% of the requested servings to qualify
- If no match is found, log the decision and send an alert notification to the NGO
- Always create_match when you find a good fit
- Always log_decision with your full reasoning`;

    const userMessage = `New food request received:
- Request ID: ${request.id}
- NGO: ${request.ngoName}
- Servings needed: ${request.servingsNeeded}
- Urgency: ${request.urgency}
- Beneficiaries: ${request.beneficiaryCount}
- Address: ${request.address}
- Needed by: ${request.neededBy?.toDate?.()?.toISOString() ?? "ASAP"}
- Notes: ${request.notes ?? "none"}

Find the best available listing and create a match. Explain your reasoning.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    // Agentic loop — keep running until no more tool calls
    let matchId: string | null = null;
    for (let turn = 0; turn < 6; turn++) {
      const response = await openai.chat.completions.create({
        model: MODELS.reasoning,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: "auto",
      });

      const msg = response.choices[0].message;
      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) break;

      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments);
        const result = await executeTool(call.function.name, args);

        if (call.function.name === "create_match" && (result as { matchId?: string }).matchId) {
          matchId = (result as { matchId: string }).matchId;
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error("[Coordinator Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}

// Needed to avoid TypeScript import error for the message param type
import type OpenAI from "openai";
