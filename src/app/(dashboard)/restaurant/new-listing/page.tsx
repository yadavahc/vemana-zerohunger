"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { createListing, getPendingRequests } from "@/lib/firebase/db";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { FoodItem } from "@/lib/types";
import { VoiceInput } from "@/components/voice-input";
import { useTranslation } from "@/context/language-context";

const langMap: Record<string, string> = {
  en: "en-IN", kn: "kn-IN", hi: "hi-IN", te: "te-IN", ta: "ta-IN",
};

export default function NewListingPage() {
  const { appUser } = useAuth();
  const { language, t } = useTranslation();
  const router = useRouter();

  const [foodItems, setFoodItems] = useState<FoodItem[]>([{ name: "", quantity: 0, unit: "servings" }]);
  const [totalServings, setTotalServings] = useState("");
  const [expiryHours, setExpiryHours] = useState("4");
  const [address, setAddress] = useState(appUser?.address ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  function addFoodItem() {
    setFoodItems([...foodItems, { name: "", quantity: 0, unit: "servings" }]);
  }

  function removeFoodItem(index: number) {
    setFoodItems(foodItems.filter((_, i) => i !== index));
  }

  function updateFoodItem(index: number, field: keyof FoodItem, value: string | number) {
    const updated = [...foodItems];
    updated[index] = { ...updated[index], [field]: value };
    setFoodItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;

    const validItems = foodItems.filter((f) => f.name.trim());
    if (validItems.length === 0) { toast.error("Add at least one food item"); return; }
    if (!totalServings || !address) { toast.error("Fill all required fields"); return; }

    setLoading(true);
    try {
      const expiryTime = Timestamp.fromDate(
        new Date(Date.now() + parseFloat(expiryHours) * 60 * 60 * 1000)
      );

      const restaurantName = appUser.orgName ?? appUser.name;
      await createListing({
        restaurantId: appUser.uid,
        restaurantName,
        restaurantPhone: appUser.phone,
        foodItems: validItems,
        totalServings: parseInt(totalServings),
        expiryTime,
        address,
        status: "available",
        notes: notes || undefined,
      });

      // Notify NGOs with pending requests via WhatsApp (non-blocking)
      getPendingRequests().then((pending) => {
        const uniquePhones = [...new Set(pending.map((r) => r.ngoPhone).filter(Boolean))];
        uniquePhones.forEach((phone) => {
          fetch("/api/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: phone,
              message: `🍱 New Prasadam available! ${restaurantName} has posted ${totalServings} servings of surplus food. Open the app to request pickup. 🙏`,
            }),
          }).catch(() => {});
        });
      }).catch(() => {});

      toast.success("Listing posted! NGOs will be notified.");
      router.push("/restaurant");
    } catch {
      toast.error("Failed to post listing. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/restaurant" className="p-2 rounded-xl hover:bg-slate-100 transition">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Form.AddSurplusTitle")}</h1>
          <p className="text-sm text-slate-500">{t("Form.AddSurplusSubtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-[#1D9E75]">
            <UtensilsCrossed className="h-5 w-5" />
            <span className="font-semibold">{t("Form.SurplusDetails")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">{t("Form.FoodItems")}</label>
              {foodItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <Input
                    placeholder={t("Form.FoodName")}
                    value={item.name}
                    onChange={(e) => updateFoodItem(i, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder={t("Form.Qty")}
                    value={item.quantity || ""}
                    onChange={(e) => updateFoodItem(i, "quantity", parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <Select
                    value={item.unit}
                    onChange={(e) => updateFoodItem(i, "unit", e.target.value)}
                    className="w-28"
                  >
                    <option value="servings">servings</option>
                    <option value="kg">kg</option>
                    <option value="plates">plates</option>
                    <option value="packets">packets</option>
                    <option value="litres">litres</option>
                  </Select>
                  {foodItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFoodItem(i)}
                      className="p-2.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addFoodItem}
                className="flex items-center gap-1.5 text-sm text-[#1D9E75] hover:underline"
              >
                <Plus className="h-4 w-4" /> {t("Form.AddItem")}
              </button>
            </div>

            <Input
              label={`${t("Form.TotalServings")} *`}
              type="number"
              min="1"
              placeholder="100"
              value={totalServings}
              onChange={(e) => setTotalServings(e.target.value)}
            />

            <Select
              label={t("Form.FoodValidFor")}
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="24">24 hours</option>
            </Select>

            <div className="flex flex-col gap-1.5">
              <Input
                label={`${t("Form.PickupAddress")} *`}
                placeholder="Your restaurant address"
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
                rows={2}
                placeholder="Packaging details, storage notes, allergens..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-[#1D9E75] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 transition resize-none"
              />
              <VoiceInput
                languageCode={langMap[language] ?? "en-IN"}
                onTranscript={(text) => setNotes((prev) => prev ? `${prev} ${text}` : text)}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {t("Form.PostListing")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
