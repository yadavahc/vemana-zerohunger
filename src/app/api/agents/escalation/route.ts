import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { AGENT_TOOLS } from "@/lib/agents/tools";
import { executeTool } from "@/lib/agents/executor";
import type { EscalationType } from "@/lib/types";
import type OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { type, context } = await req.json() as {
      type: EscalationType;
      context: Record<string, unknown>;
    };

    const systemPrompt = `You are the Escalation Agent for Prasadam food redistribution platform.
Your job: handle workflow failures with minimal human intervention.

For each escalation type, follow this strategy:
- no_restaurant_response: Create escalation, notify admin, send reminder to restaurant
- volunteer_no_show: Create escalation, notify admin, send broadcast to find new volunteer
- food_expiring: Send urgent alert to restaurant and nearest NGO, create escalation
- quality_fail: Create escalation immediately, alert admin, do NOT dispatch food

Always:
1. create_escalation with a clear resolution strategy
2. send_notification to relevant parties with empathetic, action-oriented language (in Hindi-English mix where appropriate)
3. log_decision with full reasoning

Keep notifications warm and human — this is Prasadam, not a logistics company.`;

    const userMessage = `Escalation triggered:
Type: ${type}
Context: ${JSON.stringify(context, null, 2)}

Determine the best response strategy and execute it.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    for (let turn = 0; turn < 6; turn++) {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Escalation Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
