"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "./ui/button";
import { Mic, MicOff, MessageSquare, X, Loader2, Volume2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useTranslation } from "@/context/language-context";

const langMap: Record<string, string> = {
  english: "en-IN",
  kannada: "kn-IN",
  hindi: "hi-IN",
};

// Decode base64 WAV from Sarvam and play it
function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("playback error")); };
      audio.play().catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Browser TTS fallback
function browserSpeak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 1.0;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  });
}

type ChatEntry = { from: "user" | "bot"; text: string };

export function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([]);

  const { appUser } = useAuth();
  const { language } = useTranslation();
  const langCode = langMap[language] ?? "en-IN";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const speakResponse = useCallback(
    async (text: string, audioBase64: string | null) => {
      setIsSpeaking(true);
      try {
        if (audioBase64) {
          await playBase64Audio(audioBase64);
        } else {
          await browserSpeak(text, langCode);
        }
      } catch {
        await browserSpeak(text, langCode);
      } finally {
        setIsSpeaking(false);
      }
    },
    [langCode]
  );

  const speakText = useCallback(
    async (text: string) => {
      setIsSpeaking(true);
      try {
        const res = await fetch("/api/text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language: langCode }),
        });
        const data = await res.json();
        if (res.ok && data.audioBase64) {
          await playBase64Audio(data.audioBase64);
        } else {
          await browserSpeak(text, langCode);
        }
      } catch {
        await browserSpeak(text, langCode);
      } finally {
        setIsSpeaking(false);
      }
    },
    [langCode]
  );

  const handleToggle = async () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      const greeting = "Welcome to Prasadam Agent. How can I help you today?";
      setHistory([{ from: "bot", text: greeting }]);
      await speakText(greeting);
    }
  };

  const processTranscript = useCallback(
    async (transcript: string) => {
      setHistory((prev) => [...prev, { from: "user", text: transcript }]);
      setIsProcessing(true);

      try {
        const res = await fetch("/api/voice-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: transcript,
            role: appUser?.role ?? "volunteer",
            language_code: langCode,
          }),
        });

        const data = await res.json();
        const answerText = data.answerText ?? "Sorry, I couldn't process that.";
        setHistory((prev) => [...prev, { from: "bot", text: answerText }]);
        setIsProcessing(false);
        await speakResponse(answerText, data.audioBase64 ?? null);
      } catch {
        const msg = "Something went wrong. Please try again.";
        setHistory((prev) => [...prev, { from: "bot", text: msg }]);
        setIsProcessing(false);
        await browserSpeak(msg, langCode);
      }
    },
    [appUser?.role, langCode, speakResponse]
  );

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = langCode;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      setIsListening(false);
      processTranscript(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow mic access in your browser settings.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("[SpeechRecognition] error:", event.error);
      }
      // no-speech / aborted are normal — user just didn't speak, reset silently
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }, [langCode, processTranscript]);

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  };

  if (!appUser) return null;

  const isBusy = isProcessing || isSpeaking;

  return (
    <>
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          onClick={handleToggle}
          className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700 shadow-lg"
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-28 right-8 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-lg">Prasadam Agent</h3>
            <span className="text-xs text-gray-400 capitalize bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              {appUser.role}
            </span>
          </div>

          <div className="flex-1 p-4 space-y-3 h-64 overflow-y-auto">
            {history.map((entry, i) => (
              <div
                key={i}
                className={`flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${
                    entry.from === "user"
                      ? "bg-green-100 text-green-900"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t flex flex-col items-center gap-2">
            <Button
              onClick={handleMicClick}
              disabled={isBusy}
              className={`w-16 h-16 rounded-full transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={24} />
              ) : isSpeaking ? (
                <Volume2 size={24} />
              ) : isListening ? (
                <MicOff size={24} />
              ) : (
                <Mic size={24} />
              )}
            </Button>
            <p className="text-xs text-gray-400">
              {isListening
                ? "Listening… tap to stop"
                : isProcessing
                ? "Processing…"
                : isSpeaking
                ? "Speaking…"
                : "Tap mic to speak"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
