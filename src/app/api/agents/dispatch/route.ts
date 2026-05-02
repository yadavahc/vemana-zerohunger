import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { AGENT_TOOLS } from "@/lib/agents/tools";
import { executeTool } from "@/lib/agents/executor";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { COLLECTIONS, createDelivery, updateMatch, updateRequest } from "@/lib/firebase/db";
import type { Match } from "@/lib/types";
import type OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { matchId } = await req.json();
    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

    const snap = await getDoc(doc(db, COLLECTIONS.MATCHES, matchId));
    if (!snap.exists()) return NextResponse.json({ error: "Match not found" }, { status: 404 });
    const match = { id: snap.id, ...snap.data() } as Match;

    // Fetch listing and request details
    const [listingSnap, requestSnap] = await Promise.all([
      getDoc(doc(db, COLLECTIONS.LISTINGS, match.listingId)),
      getDoc(doc(db, COLLECTIONS.REQUESTS, match.requestId)),
    ]);

    if (!listingSnap.exists() || !requestSnap.exists()) {
      return NextResponse.json({ error: "Listing or request not found" }, { status: 404 });
    }

    const listing = listingSnap.data();
    const request = requestSnap.data();

    // Create the delivery record first (status: finding_volunteer)
    const deliveryId = await createDelivery({
      matchId: match.id,
      requestId: match.requestId,
      listingId: match.listingId,
      pickupAddress: listing.address,
      dropAddress: request.address,
      status: "finding_volunteer",
    });

    await Promise.all([
      updateMatch(match.id, { status: "dispatched" }),
      updateRequest(match.requestId, { status: "dispatched" }),
    ]);

    // Fetch available volunteers
    const volunteersSnap = await getDocs(
      query(collection(db, COLLECTIONS.USERS), where("role", "==", "volunteer"))
    );
    const volunteers = volunteersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const systemPrompt = `You are the Dispatch Agent for Prasadam food redistribution platform.
Your job: select the best available volunteer for a food delivery.

Rules:
- Review the list of volunteers and choose based on: recent activity, availability signals
- If volunteers list is empty, just notify all volunteers with a broadcast notification and log it
- If a good volunteer is found, call assign_volunteer
- Always log_decision with your reasoning`;

    const userMessage = `New delivery needs a volunteer:
- Delivery ID: ${deliveryId}
- Pickup: ${listing.address} (${listing.restaurantName})
- Drop: ${request.address} (${request.ngoName})
- Food: ${listing.foodItems?.map((f: { name: string }) => f.name).join(", ")}
- Servings: ${listing.totalServings}

Available volunteers (${volunteers.length}):
${volunteers.slice(0, 10).map((v: Record<string, unknown>) => `- ID: ${v.id}, Name: ${v.name}, Phone: ${v.phone}`).join("\n") || "No volunteers registered yet"}

Select the best volunteer or broadcast to all if uncertain.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    for (let turn = 0; turn < 5; turn++) {
      const response = await openai.chat.completions.create({
        model: MODELS.fast,
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
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return NextResponse.json({ success: true, deliveryId });
  } catch (error) {
    console.error("[Dispatch Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
