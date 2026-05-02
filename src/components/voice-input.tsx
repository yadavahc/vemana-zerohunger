"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  languageCode?: string;
  maxSeconds?: number;
  className?: string;
}

type State = "idle" | "recording" | "processing";

const langLabels: Record<string, string> = {
  "en-IN": "EN", "kn-IN": "ಕನ್ನಡ", "hi-IN": "हिंदी", "te-IN": "తెలుగు", "ta-IN": "தமிழ்",
};

/** Pick the best supported MIME type for MediaRecorder on this browser. */
function getSupportedMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm"; // fallback — let the browser decide
}

export function VoiceInput({
  onTranscript,
  languageCode = "en-IN",
  maxSeconds = 30,
  className = "",
}: VoiceInputProps) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      autoStopRef.current && clearTimeout(autoStopRef.current);
    };
  }, []);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopTimer() {
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Microphone not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTimer();
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribe(blob, mimeType);
      };

      recorder.start(250); // collect data every 250ms so onstop has chunks
      mediaRecorderRef.current = recorder;
      setState("recording");
      startTimer();

      // Auto-stop after maxSeconds
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, maxSeconds * 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
      setState("idle");
    }
  }

  function stopRecording() {
    autoStopRef.current && clearTimeout(autoStopRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  async function transcribe(audio: Blob, mimeType: string) {
    try {
      const form = new FormData();
      // Send as File so the server gets the correct .type property
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
      form.append("audio", new File([audio], `recording.${ext}`, { type: mimeType }));
      form.append("language_code", languageCode);

      const res = await fetch("/api/voice", { method: "POST", body: form });
      const data = await res.json() as { transcript?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Recognition failed. Please try again.");
      } else if (!data.transcript) {
        setError("No speech detected. Please speak clearly and try again.");
      } else {
        setError(null);
        onTranscript(data.transcript);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setState("idle");
      setElapsed(0);
    }
  }

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const langLabel = langLabels[languageCode] ?? languageCode;

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        title={isRecording ? "Tap to stop recording" : `Speak in ${langLabel}`}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all select-none
          ${isRecording
            ? "bg-red-50 border-red-300 text-red-700"
            : isProcessing
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-[#1D9E75]/5 border-[#1D9E75]/30 text-[#1D9E75] hover:bg-[#1D9E75]/10"
          }`}
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
        ) : isRecording ? (
          <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <MicOff className="relative h-3.5 w-3.5" />
          </span>
        ) : (
          <Mic className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span>
          {isProcessing
            ? "Transcribing…"
            : isRecording
            ? `Recording ${elapsed}s — tap to stop`
            : `Speak in ${langLabel}`}
        </span>
      </button>
      {error && (
        <p className="text-xs text-red-500 max-w-xs">{error}</p>
      )}
    </div>
  );
}
