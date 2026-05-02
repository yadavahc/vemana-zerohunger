"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { createRequest } from "@/lib/firebase/db";
import { urgencyPriority } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { VoiceInput } from "@/components/voice-input";
import { useTranslation } from "@/context/language-context";
import { ArrowLeft, Utensils } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { UrgencyLevel } from "@/lib/types";

// Maps language context to Sarvam language codes
const langMap: Record<string, string> = {
  en: "en-IN", kn: "kn-IN", hi: "hi-IN", te: "te-IN", ta: "ta-IN",
};

export default function RequestFoodPage() {
  const { appUser } = useAuth();
  const { language, t } = useTranslation();
  const router = useRouter();

  const [servings, setServings] = useState("");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("medium");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [neededInHours, setNeededInHours] = useState("4");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;

    const servingsNum = parseInt(servings);
    const beneficiariesNum = parseInt(beneficiaries);
    const hoursNum = parseFloat(neededInHours);

    if (!servingsNum || !beneficiariesNum || !address) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const neededBy = Timestamp.fromDate(new Date(Date.now() + hoursNum * 60 * 60 * 1000));
      const minutesUntilNeeded = hoursNum * 60;
      const priority = urgencyPriority(urgency, beneficiariesNum, minutesUntilNeeded);

      const requestId = await createRequest({
        ngoId: appUser.uid,
        ngoName: appUser.orgName ?? appUser.name,
        ngoPhone: appUser.phone,
        beneficiaryCount: beneficiariesNum,
        servingsNeeded: servingsNum,
        urgency,
        address,
        status: "pending",
        priority,
        notes: notes || undefined,
        neededBy,
      });

      // Trigger coordinator agent
      await fetch("/api/agents/coordinator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      toast.success("Request submitted! Finding the best match for you.");
      router.push("/ngo");
    } catch {
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ngo" className="p-2 rounded-xl hover:bg-slate-100 transition">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Form.RequestFood")}</h1>
          <p className="text-sm text-slate-500">{t("Form.RequestSubtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-[#1D9E75]">
            <Utensils className="h-5 w-5" />
            <span className="font-semibold">{t("Form.RequestFood")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={`${t("Form.ServingsNeeded")} *`}
                type="number"
                min="1"
                placeholder="50"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
              <Input
                label={`${t("Form.BeneficiaryCount")} *`}
                type="number"
                min="1"
                placeholder="50"
                value={beneficiaries}
                onChange={(e) => setBeneficiaries(e.target.value)}
              />
            </div>

            <Select
              label={t("Form.Urgency")}
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
            >
              <option value="low">Low — can wait till tomorrow</option>
              <option value="medium">Medium — need within 4 hours</option>
              <option value="high">High — need within 2 hours</option>
              <option value="critical">Critical — immediate need</option>
            </Select>

            <Select
              label="Needed within"
              value={neededInHours}
              onChange={(e) => setNeededInHours(e.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="24">Tomorrow</option>
            </Select>

            <div className="flex flex-col gap-1.5">
              <Input
                label={`${t("Form.PickupAddress")} *`}
                placeholder="Full address where food should be delivered"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <VoiceInput
                languageCode={langMap[language] ?? "en-IN"}
                onTranscript={(text) => setAddress((prev) => prev ? `${prev} ${text}` : text)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">{t("Form.Notes")}</label>
              <textarea
                rows={3}
                placeholder={t("Form.NotesHint")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D9E75] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 transition resize-none"
              />
              <VoiceInput
                languageCode={langMap[language] ?? "en-IN"}
                onTranscript={(text) => setNotes((prev) => prev ? `${prev} ${text}` : text)}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {t("Form.SubmitRequest")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
