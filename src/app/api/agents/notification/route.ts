/**
 * Notification Agent — uses AI to craft warm, contextual,
 * culturally appropriate notification messages for every event.
 */

import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { createNotification } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";

type NotificationEvent =
  | "match_found"
  | "approval_needed"
  | "delivery_assigned"
  | "delivery_completed"
  | "no_supply"
  | "sla_warning"
  | "volunteer_needed";

interface NotificationRequest {
  event: NotificationEvent;
  userId: string;
  role: string;
  context: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const { event, userId, role, context } = await req.json() as NotificationRequest;

    const response = await openai.chat.completions.create({
      model: MODELS.fast,
      messages: [
        {
          role: "system",
          content: `You craft notification messages for Prasadam, a food redistribution platform rooted in the Indian tradition of sharing blessed food.

Tone: warm, respectful, action-oriented. Use simple English. You may occasionally include a short Hindi phrase where it feels natural (e.g., "Dhanyavaad 🙏").

Respond ONLY with valid JSON:
{ "title": "max 60 chars", "body": "max 140 chars" }

Guidelines per role:
- restaurant: grateful, emphasise impact ("your food will feed X people")
- ngo: reassuring, clear next steps
- volunteer: energising, mission-focused
- admin: factual, concise`,
        },
        {
          role: "user",
          content: `Event: ${event}
Recipient role: ${role}
Context: ${JSON.stringify(context)}

Write the notification.`,
        },
      ],
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const { title, body } = JSON.parse(response.choices[0].message.content ?? "{}") as {
      title: string;
      body: string;
    };

    const typeMap: Record<NotificationEvent, Parameters<typeof createNotification>[0]["type"]> = {
      match_found: "match",
      approval_needed: "approval",
      delivery_assigned: "dispatch",
      delivery_completed: "delivery",
      no_supply: "alert",
      sla_warning: "alert",
      volunteer_needed: "dispatch",
    };

    const notifId = await createNotification({
      userId,
      title,
      body,
      type: typeMap[event] ?? "alert",
      read: false,
      metadata: context,
    });

    return NextResponse.json({ success: true, notifId, title, body });
  } catch (error) {
    console.error("[Notification Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
