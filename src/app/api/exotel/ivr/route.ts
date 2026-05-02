import { NextRequest, NextResponse } from "next/server";
import { ExotelIvrResponse } from "@/lib/exotel";

export const dynamic = "force-dynamic";

// This is the entry point for Exotel calls
export async function GET(req: NextRequest) {
  const ivr = new ExotelIvrResponse();
  const searchParams = req.nextUrl.searchParams;
  const userInput = searchParams.get("digits")?.replace(/"/g, "");
  const step = searchParams.get("step") ?? "start";

  console.log(`[IVR] Call received. Step: ${step}, Input: ${userInput}`);

  try {
    switch (step) {
      case "start":
        return startStep(ivr);
      case "language":
        return await handleLanguageSelection(ivr, userInput);
      case "role":
        return await handleRoleSelection(ivr, userInput);
      case "voice_input":
        return await handleVoiceInput(ivr, searchParams);
      default:
        ivr.say("Invalid step. Please try again.");
        ivr.hangup();
        return ivr.send();
    }
  } catch (error) {
    console.error("[IVR] Error processing step:", error);
    ivr.say("An unexpected error occurred. We are sorry for the inconvenience.");
    ivr.hangup();
    return ivr.send();
  }
}

function startStep(ivr: ExotelIvrResponse) {
  console.log("[IVR] Executing 'start' step.");
  const gather = ivr.gather({
    action: "/api/exotel/ivr?step=language",
    numDigits: 1,
    timeout: 10,
  });
  gather.say(
    "Welcome to Prasadam. Press 1 for Kannada. Press 2 for English. Press 3 for Hindi."
  );
  return ivr.send();
}

async function handleLanguageSelection(
  ivr: ExotelIvrResponse,
  userInput: string | null | undefined
) {
  console.log(`[IVR] Executing 'language' step with input: ${userInput}`);
  const langMap: Record<string, string> = {
    "1": "kn-IN",
    "2": "en-IN",
    "3": "hi-IN",
  };
  const language = userInput ? langMap[userInput] : "en-IN";

  const gather = ivr.gather({
    action: `/api/exotel/ivr?step=role&lang=${language}`,
    numDigits: 1,
    timeout: 10,
  });
  gather.say(
    "Press 1 if you are an NGO. Press 2 if you are a Donor. Press 3 if you are a Volunteer."
  );
  return ivr.send();
}

async function handleRoleSelection(
  ivr: ExotelIvrResponse,
  userInput: string | null | undefined
) {
  console.log(`[IVR] Executing 'role' step with input: ${userInput}`);
  const lang = ivr.searchParams.get("lang") ?? "en-IN";
  const roleMap: Record<string, string> = {
    "1": "ngo",
    "2": "donor",
    "3": "volunteer",
  };
  const role = userInput ? roleMap[userInput] : "donor";

  ivr.say("Please state your query after the beep.");
  ivr.record({
    action: `/api/exotel/ivr?step=voice_input&lang=${lang}&role=${role}`,
    maxLength: 30,
    timeout: 5,
    finishOnKey: "#",
  });

  return ivr.send();
}

async function handleVoiceInput(
  ivr: ExotelIvrResponse,
  searchParams: URLSearchParams
) {
  const recordingUrl = searchParams.get("RecordingUrl");
  const lang = searchParams.get("lang") ?? "en-IN";
  const role = searchParams.get("role") ?? "donor";

  console.log(`[IVR] Voice input received. URL: ${recordingUrl}`);

  if (!recordingUrl) {
    ivr.say("Sorry, I could not hear your response. Please call again.");
    ivr.hangup();
    return ivr.send();
  }

  try {
    // 1. Fetch the recorded audio from Exotel
    const audioRes = await fetch(recordingUrl);
    if (!audioRes.ok) throw new Error("Failed to fetch audio from Exotel");
    const audioBlob = await audioRes.blob();

    // 2. Send to our /api/voice endpoint for STT, NLU, and TTS
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    formData.append("language_code", lang);
    formData.append("role", role);

    const voiceApiUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/voice`;
    const voiceRes = await fetch(voiceApiUrl, {
      method: "POST",
      body: formData,
    });

    if (!voiceRes.ok) {
      const errorData = await voiceRes.json();
      throw new Error(
        `Voice API failed: ${voiceRes.status} ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const voiceData = await voiceRes.json();

    // 3. Play back the TTS audio response from the voice API
    if (voiceData.audioBase64) {
      const audioUrl = `data:audio/wav;base64,${voiceData.audioBase64}`;
      ivr.play(audioUrl);
    } else {
      ivr.say(voiceData.answerText || "I could not process your request.");
    }

    ivr.hangup();
    return ivr.send();
  } catch (error) {
    console.error("[IVR] Error in voice input processing:", error);
    ivr.say("There was an error processing your voice command. Please try again.");
    ivr.hangup();
    return ivr.send();
  }
}
