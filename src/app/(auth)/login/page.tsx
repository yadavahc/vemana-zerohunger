"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmationResult } from "firebase/auth";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Leaf, Phone, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/lib/types";
import toast from "react-hot-toast";
import { useTranslation } from "@/context/language-context";

const roleRedirects: Record<UserRole, string> = {
  ngo: "/ngo",
  restaurant: "/restaurant",
  volunteer: "/volunteer",
  admin: "/admin",
  beneficiary: "/beneficiary",
  donor: "/donor",
};

export default function LoginPage() {
  const { sendOtp, confirmOtp, createProfile } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedRole = (searchParams.get("role") as UserRole) ?? "ngo";
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState<UserRole>(preselectedRole);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!phone.match(/^\+\d{10,15}$/)) {
      toast.error("Enter a valid phone number with country code, e.g. +91XXXXXXXXXX");
      return;
    }
    setLoading(true);
    try {
      const result = await sendOtp(phone);
      setConfirmation(result);
      setStep("otp");
      toast.success("OTP sent!");
    } catch {
      toast.error("Failed to send OTP. Check the number and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOtp() {
    if (!confirmation || !otp.trim()) return;
    setLoading(true);
    try {
      // OTP is confirmed exactly once here — never again
      const { hasProfile } = await confirmOtp(confirmation, otp);
      if (hasProfile) {
        // Returning user — go straight to their dashboard
        // appUser is set inside confirmOtp; read role from getUser result via a short wait
        await new Promise((r) => setTimeout(r, 300));
        const { auth } = await import("@/lib/firebase/config");
        const { getUser } = await import("@/lib/firebase/db");
        const profile = await getUser(auth.currentUser!.uid);
        router.push(roleRedirects[profile!.role]);
      } else {
        // New user — collect profile info (already signed in, just need Firestore doc)
        setStep("profile");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("invalid-verification-code") || msg.includes("invalid-verification")) {
        toast.error("Wrong OTP. Please try again.");
      } else if (msg.includes("expired")) {
        toast.error("OTP expired. Please request a new one.");
        setStep("phone");
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteProfile() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setLoading(true);
    try {
      // User is already authenticated — just create the Firestore profile doc
      await createProfile(role, name, orgName || undefined, email || undefined);
      toast.success("Welcome to Prasadam!");
      router.push(roleRedirects[role]);
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1D9E75]/10 via-white to-[#EF9F27]/10 flex items-center justify-center p-4">
      <div id="recaptcha-container" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#1D9E75] text-white mb-4">
            <Leaf className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Prasadam</h1>
          <p className="text-slate-500 mt-2">प्रसादम् · Blessed food, shared with all</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          {step === "phone" && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <Phone className="h-8 w-8 text-[#1D9E75] mx-auto mb-2" />
                <h2 className="text-xl font-semibold text-slate-900">{t("Login.SignInPhone")}</h2>
                <p className="text-sm text-slate-500 mt-1">{t("Login.OTPSent")}</p>
              </div>
              <Input
                label={t("Login.PhoneLabel")}
                placeholder="+91XXXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
              />
              <Button className="w-full" size="lg" onClick={handleSendOtp} loading={loading}>
                {t("Login.SendOTP")}
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <ShieldCheck className="h-8 w-8 text-[#1D9E75] mx-auto mb-2" />
                <h2 className="text-xl font-semibold text-slate-900">{t("Login.EnterOTP")}</h2>
                <p className="text-sm text-slate-500 mt-1">{t("Login.OTPSentTo")} {phone}</p>
              </div>
              <Input
                label="6-digit OTP"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                autoFocus
              />
              <Button className="w-full" size="lg" onClick={handleConfirmOtp} loading={loading}>
                {t("Login.VerifyOTP")}
              </Button>
              <button
                className="w-full text-sm text-slate-500 hover:text-[#1D9E75]"
                onClick={() => { setStep("phone"); setOtp(""); }}
              >
                {t("Login.UseDifferent")}
              </button>
            </div>
          )}

          {step === "profile" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900">{t("Login.CompleteProfile")}</h2>
                <p className="text-sm text-slate-500 mt-1">{t("Login.TellUs")}</p>
              </div>
              <Select
                label={t("Login.IAmA")}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="ngo">NGO / Food Bank</option>
                <option value="restaurant">Restaurant / Supplier</option>
                <option value="donor">Individual Donor</option>
                <option value="volunteer">Volunteer</option>
                <option value="admin">Admin / Operator</option>
                <option value="beneficiary">Beneficiary</option>
              </Select>
              <Input
                label={t("Login.YourName")}
                placeholder={t("Login.FullName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {(role === "ngo" || role === "restaurant") && (
                <Input
                  label={t("Login.OrgName")}
                  placeholder="e.g. Akshaya Patra, Hotel Taj"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              )}
              <Input
                label={t("Login.EmailLabel")}
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" size="lg" onClick={handleCompleteProfile} loading={loading}>
                {t("Login.GetStarted")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
