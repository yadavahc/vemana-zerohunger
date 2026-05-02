import { VoiceIntentResult } from "./sarvam-ai";
import toast from "react-hot-toast";

export const handleAdminVoiceIntent = (intent: VoiceIntentResult) => {
  toast.success(`Admin intent: ${intent.intent}`);
};

export const handleDonorVoiceIntent = (intent: VoiceIntentResult) => {
  toast.success(`Donor intent: ${intent.intent}`);
};

export const handleNgoVoiceIntent = (intent: VoiceIntentResult) => {
  toast.success(`NGO intent: ${intent.intent}`);
};

export const handleRestaurantVoiceIntent = (intent: VoiceIntentResult) => {
  toast.success(`Restaurant intent: ${intent.intent}`);
};

export const handleVolunteerVoiceIntent = (intent: VoiceIntentResult) => {
  toast.success(`Volunteer intent: ${intent.intent}`);
};
