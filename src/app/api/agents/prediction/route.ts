/**
 * Surplus Prediction Agent — analyses historical listing patterns
 * and predicts tomorrow's surplus so NGOs can plan ahead.
 */

import { NextRequest, NextResponse } from "next/server";
import openai, { MODELS } from "@/lib/openai";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { COLLECTIONS, logAgentDecision } from "@/lib/firebase/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { restaurantId } = await req.json() as { restaurantId?: string };

    // Fetch last 30 days of listings
    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const listingsRef = collection(db, COLLECTIONS.LISTINGS);

    const constraints = restaurantId
      ? [where("restaurantId", "==", restaurantId), limit(100)]
      : [limit(100)];

    const snap = await getDocs(query(listingsRef, ...constraints));
    const listings = snap.docs.map((d) => {
      const data = d.data();
      return {
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName,
        foodItems: data.foodItems,
        totalServings: data.totalServings,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        expiryTime: data.expiryTime?.toDate?.()?.toISOString() ?? null,
        status: data.status,
      };
    });

    if (listings.length === 0) {
      return NextResponse.json({
        success: true,
        predictions: [],
        summary: "Not enough historical data yet. Predictions will improve as more listings are posted.",
      });
    }

    const response = await openai.chat.completions.create({
      model: MODELS.reasoning,
      messages: [
        {
          role: "system",
          content: `You are a surplus prediction analyst for Prasadam, India's food redistribution platform.
Analyse historical food listing data and predict tomorrow's surplus.

Respond ONLY with valid JSON:
{
  "predictions": [
    {
      "restaurantName": "string",
      "expectedServings": number,
      "likelyFoodTypes": ["string"],
      "expectedTime": "HH:MM",
      "confidence": "high" | "medium" | "low",
      "reasoning": "brief explanation"
    }
  ],
  "summary": "2-3 sentence overview of tomorrow's expected surplus",
  "ngoRecommendation": "What NGOs should prepare for tomorrow",
  "peakWindow": "time window with highest expected surplus e.g. 2PM-4PM"
}`,
        },
        {
          role: "user",
          content: `Historical listing data (last 30 days):
${JSON.stringify(listings, null, 2)}

Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}.
Predict tomorrow's surplus and give NGOs advance notice to prepare.`,
        },
      ],
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content ?? "{}");

    await logAgentDecision("prediction", "surplus_predicted", {
      restaurantId: restaurantId ?? "all",
      predictionsCount: result.predictions?.length ?? 0,
      peakWindow: result.peakWindow,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Prediction Agent]", error);
    return NextResponse.json({ error: "Agent failed" }, { status: 500 });
  }
}
