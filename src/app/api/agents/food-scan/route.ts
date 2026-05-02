import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { logAgentDecision } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("[Food Scan] OpenAI API key not configured");
      return NextResponse.json(
        { error: "API not configured. Please add OPENAI_API_KEY to .env.local" },
        { status: 503 }
      );
    }

    // Accept either base64 data URL (preferred) or a remote imageUrl
    const { imageData, imageUrl, userId } = await req.json() as {
      imageData?: string;
      imageUrl?: string;
      userId: string;
    };

    const imageSource = imageData ?? imageUrl;
    if (!imageSource) {
      return NextResponse.json({ error: "imageData or imageUrl required" }, { status: 400 });
    }

    console.log("[Food Scan] Starting analysis for user:", userId);

    const response = await openai.chat.completions.create({
      model: MODELS.vision,
      messages: [
        {
          role: "system",
          content: `You are a food safety expert for Prasadam, India's food redistribution platform.
An individual donor has uploaded a photo of food they want to donate.

Assess the food and respond ONLY with valid JSON in this exact shape:
{
  "safe": true | false,
  "foodName": "descriptive name (e.g. 'Rice and dal', 'Biryani', 'Rotis')",
  "estimatedServings": number (how many people this can feed, minimum 1),
  "freshness": "fresh" | "acceptable" | "questionable" | "expired",
  "confidence": "high" | "medium" | "low",
  "issues": ["issue1", "issue2"] or [],
  "recommendation": "one warm, clear sentence — encourage if safe, explain kindly if not",
  "category": "cooked_meal" | "raw_produce" | "packaged" | "bakery" | "other"
}

Guidelines:
- "safe": true for fresh/acceptable food. false only for visibly moldy, rotten, or clearly expired food.
- Be encouraging — lean towards accepting borderline cases.
- If the image is blurry or not food, set safe: false and explain in recommendation.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Assess this food donation photo:" },
            { type: "image_url", image_url: { url: imageSource, detail: "auto" } },
          ],
        },
      ],
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0].message.content ?? "{}";
    console.log("[Food Scan] Raw response:", raw.substring(0, 100) + "...");

    const result = JSON.parse(raw) as {
      safe: boolean;
      foodName: string;
      estimatedServings: number;
      freshness: string;
      confidence: string;
      issues: string[];
      recommendation: string;
      category: string;
    };

    // Ensure required fields have defaults so UI never crashes
    result.foodName = result.foodName ?? "Unknown food";
    result.estimatedServings = result.estimatedServings ?? 1;
    result.freshness = result.freshness ?? "questionable";
    result.confidence = result.confidence ?? "low";
    result.issues = result.issues ?? [];
    result.recommendation = result.recommendation ?? "Please try a clearer photo.";
    result.category = result.category ?? "other";

    console.log("[Food Scan] Analysis complete:", {
      safe: result.safe,
      foodName: result.foodName,
      estimatedServings: result.estimatedServings,
    });

    // Fire-and-forget — never let logging block or fail the response
    logAgentDecision("food_scan", result.safe ? "approved" : "rejected", {
      userId,
      foodName: result.foodName,
      estimatedServings: result.estimatedServings,
      freshness: result.freshness,
      confidence: result.confidence,
    }).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Food Scan Agent] Full error:", {
      message: errorMessage,
      type: error instanceof Error ? error.constructor.name : typeof error,
      error,
    });

    // Provide helpful error messages based on error type
    let userMessage = "Scan failed. Please try again.";
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      userMessage = "API authentication failed. Check your OpenAI API key.";
    } else if (errorMessage.includes("429") || errorMessage.includes("rate")) {
      userMessage = "API rate limit exceeded. Please wait a moment and try again.";
    } else if (errorMessage.includes("timeout")) {
      userMessage = "Analysis took too long. Please try with a clearer photo.";
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
