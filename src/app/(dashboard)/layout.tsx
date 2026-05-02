"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { NavBar } from "@/components/nav-bar";
import { VoiceAssistant } from "@/components/voice-assistant";

const roleHomePaths: Record<string, string> = {
  ngo: "/ngo",
  restaurant: "/restaurant",
  volunteer: "/volunteer",
  admin: "/admin",
  beneficiary: "/beneficiary",
  donor: "/donor",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      <VoiceAssistant />
    </div>
  );
}
