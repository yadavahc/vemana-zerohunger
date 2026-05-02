import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Sarvam API key not configured" }, { status: 503 });
  }

  try {
    const { text, language } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const langCode =
      typeof language === "string" && language.includes("-") ? language : "en-IN";

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        inputs: [text],
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Sarvam TTS] Error:", response.status, errText);
      return NextResponse.json({ error: "TTS failed", detail: errText }, { status: 502 });
    }

    const data = await response.json();
    const audioBase64: string | null = data?.audios?.[0] ?? null;

    if (!audioBase64) {
      console.error("[Sarvam TTS] No audios in response:", data);
      return NextResponse.json({ error: "No audio returned by TTS" }, { status: 502 });
    }

    return NextResponse.json({ audioBase64 });
  } catch (error) {
    console.error("[API/text-to-speech] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
