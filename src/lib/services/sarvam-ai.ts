export type VoiceIntentResult = {
    intent: string;
    confidence: number;
    parameters: Record<string, any>;
    answerText: string;
  };
  