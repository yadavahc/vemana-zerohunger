import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Sarvam API key not configured" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const languageCode = (formData.get("language_code") as string) || "en-IN";
    const role = (formData.get("role") as string) || "volunteer";

    if (!audio) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }

    // Preserve the actual content-type so Sarvam knows the format (webm, mp4, wav, etc.)
    const mimeType = audio.type || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";

    console.log(`[Voice] Processing ${role} audio: ${mimeType} → ${languageCode}`);

    // 1. STT with Sarvam AI
    const sarvamForm = new FormData();
    sarvamForm.append("file", new Blob([await audio.arrayBuffer()], { type: mimeType }), `recording.${ext}`);
    sarvamForm.append("model", "saarika:v2");
    sarvamForm.append("language_code", languageCode);
    sarvamForm.append("with_timestamps", "false");
    sarvamForm.append("with_disfluencies", "false");

    console.log(`[Voice] Calling Sarvam STT...`);
    const sttRes = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: sarvamForm,
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      console.error("[Sarvam STT] Error:", sttRes.status, errText);
      return NextResponse.json({ error: "Speech recognition failed", detail: errText }, { status: 502 });
    }

    const sttData = await sttRes.json() as { transcript?: string };
    const transcript = (sttData.transcript ?? "").trim();

    console.log(`[Voice] Transcript: "${transcript}"`);

    if (!transcript) {
      return NextResponse.json({ error: "No transcript generated" }, { status: 400 });
    }

    // 2. OpenAI Intent Parsing & Response Generation
    console.log(`[Voice] Calling OpenAI for role: ${role}`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful voice assistant for the "Prasadam" food redistribution platform. The user is a ${role}.

Your task:
1. Identify the user's intent from their speech
2. Generate a SHORT voice response (under 20 words) acknowledging their intent and providing next steps

Available intents per role:
- ngo: create_request, find_food, check_status
- restaurant/donor: approve_match, decline_match, check_status, toggle_auto_approve
- volunteer: accept_delivery, mark_picked_up, mark_in_transit, mark_delivered, start_pickups, check_status
- admin: show_stats, list_escalations, resolve_escalation, check_status

Output VALID JSON matching this schema:
{
  "intent": "string - one of the available intents above",
  "confidence": 0.0-1.0,
  "parameters": { "any": "contextual_parameters" },
  "answerText": "string - short voice response to the user in the same language they spoke"
}`,
        },
        {
          role: "user",
          content: `User (${role}): "${transcript}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const aiResultStr = completion.choices[0].message.content || "{}";
    let aiResult;
    try {
      aiResult = JSON.parse(aiResultStr);
    } catch (e) {
      console.error("[Voice] JSON parse error:", aiResultStr);
      aiResult = { intent: "unknown", confidence: 0, parameters: {}, answerText: "I didn't understand that." };
    }

    console.log(`[Voice] Intent: ${aiResult.intent}, Confidence: ${aiResult.confidence}`);

    let audioBase64 = null;

    // 3. TTS with Sarvam AI - Convert response to speech
    if (aiResult.answerText) {
      console.log(`[Voice] Calling Sarvam TTS for: "${aiResult.answerText}"`);
      try {
        const ttsRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": apiKey,
          },
          body: JSON.stringify({
            inputs: [aiResult.answerText],
            target_language_code: languageCode.includes("-") ? languageCode : "en-IN",
            speaker: "meera",
            pitch: 0,
            pace: 1.0,
            loudness: 1.5,
            speech_sample_rate: 8000,
            enable_preprocessing: true,
            model: "bulbul:v1"
          }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          // Sarvam TTS response contains "audios" array with base64 strings
          if (ttsData && ttsData.audios && Array.isArray(ttsData.audios) && ttsData.audios.length > 0) {
            audioBase64 = ttsData.audios[0];
            console.log(`[Voice] TTS successful, audio length: ${audioBase64?.length || 0}`);
          } else {
            console.warn("[Sarvam TTS] No audios in response:", ttsData);
          }
        } else {
          const errText = await ttsRes.text();
          console.error("[Sarvam TTS] Error:", ttsRes.status, errText);
        }
      } catch (ttsErr) {
        console.error("[Voice] TTS exception:", ttsErr);
      }
    }

    const response = {
      success: true,
      transcript,
      intent: aiResult.intent || "unknown",
      confidence: aiResult.confidence || 0,
      parameters: aiResult.parameters || {},
      answerText: aiResult.answerText || "Command processed",
      audioBase64,
    };

    console.log(`[Voice] Response ready, audio included: ${!!audioBase64}`);
    return NextResponse.json(response);
  } catch (err) {
    console.error("[Voice route] Exception:", err);
    return NextResponse.json(
      { error: "Voice processing failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
