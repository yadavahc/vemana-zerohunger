/**
 * Quality Check Agent — uses OpenAI Vision to analyse a food photo
 * uploaded by a volunteer before redistribution.
 * Returns: { passed: boolean, issues: string[], recommendation: string }
 */

import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { updateDelivery, createNotification, logAgentDecision } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { deliveryId, imageUrl, volunteerId } = await req.json();

    if (!deliveryId || !imageUrl) {
      return NextResponse.json({ error: "deliveryId and imageUrl required" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: MODELS.vision,
      messages: [
        {
          role: "system",
          content: `You are a food safety inspector for Prasadam, a food redistribution platform in India.
Your job: assess whether the food in the photo is safe to redistribute to beneficiaries.

Evaluate:
1. Visual freshness (colour, texture, no visible spoilage)
2. Proper packaging or containment
3. Any signs of contamination, mould, or unsafe handling
4. Overall suitability for redistribution

Respond ONLY with valid JSON in this exact shape:
{
  "passed": true | false,
  "confidence": "high" | "medium" | "low",
  "issues": ["issue1", "issue2"],
  "recommendation": "one clear sentence on what to do next",
  "details": "brief description of what you observed"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please assess this food for safe redistribution as Prasadam:",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content ?? "{}";
    const result = JSON.parse(raw) as {
      passed: boolean;
      confidence: string;
      issues: string[];
      recommendation: string;
      details: string;
    };

    // Update delivery with quality check result
    await updateDelivery(deliveryId, {
      foodPhotoUrl: imageUrl,
      qualityCheckStatus: result.passed ? "passed" : "failed",
      qualityCheckNotes: result.recommendation,
    });

    // Notify based on result
    if (result.passed) {
      await createNotification({
        userId: volunteerId ?? "admin",
        title: "Quality check passed ✓",
        body: result.recommendation,
        type: "delivery",
        read: false,
        metadata: { deliveryId, confidence: result.confidence },
      });
    } else {
      // Trigger escalation for failed check
      await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "" : "http://localhost:3000"}/api/agents/escalation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quality_fail",
          context: { deliveryId, volunteerId, issues: result.issues, recommendation: result.recommendation },
        }),
      }).catch(() => {}); // non-blocking

      await createNotification({
        userId: volunteerId ?? "admin",
        title: "Quality check failed",
        body: result.recommendation,
        type: "alert",
        read: false,
        metadata: { deliveryId, issues: result.issues },
      });
    }

    await logAgentDecision("quality_check", result.passed ? "passed" : "failed", {
      deliveryId,
      confidence: result.confidence,
      issues: result.issues,
      details: result.details,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Quality Check Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
