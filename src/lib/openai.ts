import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set — AI agents will be disabled.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export default openai;

export const MODELS = {
  reasoning: "gpt-4o",      // complex decisions, tool calling
  fast: "gpt-4o-mini",      // notifications, simple tasks
  vision: "gpt-4o",         // food quality check (vision)
} as const;
