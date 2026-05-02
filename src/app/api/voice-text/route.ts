import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { text, role, language_code } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const langCode =
      typeof language_code === "string" && language_code.includes("-")
        ? language_code
        : "en-IN";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful voice assistant for "Prasadam", a food redistribution platform connecting restaurants, NGOs, volunteers, and admins. The user is a ${role || "user"}.

Reply with a SHORT, warm voice response (max 25 words). Be conversational.

Available actions per role:
- ngo: create food request, find available food, check delivery status
- restaurant/donor: approve or decline food match, check status, toggle auto-approve
- volunteer: accept delivery, update pickup/transit/delivered status, check assignments
- admin: view system stats, list escalations, resolve issues

Output VALID JSON only:
{"intent": "string", "answerText": "short voice reply"}`,
        },
        { role: "user", content: `User (${role}): "${text}"` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    let aiResult: { intent?: string; answerText?: string } = {};
    try {
      aiResult = JSON.parse(completion.choices[0].message.content ?? "{}");
    } catch {
      aiResult = { intent: "unknown", answerText: "I didn't understand that. Please try again." };
    }

    const answerText = aiResult.answerText || "Command processed.";

    // Sarvam TTS
    const apiKey = process.env.SARVAM_API_KEY;
    let audioBase64: string | null = null;

    if (apiKey) {
      try {
        const ttsRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": apiKey,
          },
          body: JSON.stringify({
            inputs: [answerText],
            target_language_code: langCode,
            speaker: "meera",
            pitch: 0,
            pace: 1.0,
            loudness: 1.5,
            speech_sample_rate: 8000,
            enable_preprocessing: true,
            model: "bulbul:v1",
          }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          audioBase64 = ttsData?.audios?.[0] ?? null;
          console.log(`[voice-text TTS] audio length: ${audioBase64?.length ?? 0}`);
        } else {
          const errText = await ttsRes.text();
          console.error("[voice-text TTS] Sarvam error:", ttsRes.status, errText);
        }
      } catch (ttsErr) {
        console.error("[voice-text TTS] Exception:", ttsErr);
      }
    }

    return NextResponse.json({
      success: true,
      intent: aiResult.intent ?? "unknown",
      answerText,
      audioBase64,
    });
  } catch (err) {
    console.error("[voice-text] Error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
