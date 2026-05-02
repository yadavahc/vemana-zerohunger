"use client";

import Link from "next/link";
import { Leaf, Building2, UtensilsCrossed, User, ShieldCheck, ArrowRight, Sparkles, Camera } from "lucide-react";

const roles = [
  {
    role: "ngo",
    icon: Building2,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    badge: "NGO / Food Bank",
    title: "Request Food for Your Community",
    desc: "Submit food requests for your beneficiaries. Our AI matches you with the nearest surplus in minutes.",
    perks: [
      "Real-time surplus matching",
      "Track every delivery live",
      "Receive WhatsApp alerts",
      "Impact dashboard",
    ],
    cta: "Join as NGO",
    border: "hover:border-blue-300",
    glow: "hover:shadow-blue-100",
  },
  {
    role: "restaurant",
    icon: UtensilsCrossed,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "Restaurant / Supplier",
    title: "Give Your Surplus a Purpose",
    desc: "Post excess food in 30 seconds. Volunteers pick it up and deliver it to those in need.",
    perks: [
      "Post listings instantly",
      "Approve matches in one tap",
      "WhatsApp notification flow",
      "Track your social impact",
    ],
    cta: "Join as Supplier",
    border: "hover:border-amber-300",
    glow: "hover:shadow-amber-100",
  },
  {
    role: "donor",
    icon: Camera,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    badge: "Individual Donor",
    title: "Share Food from Home or Events",
    desc: "Snap a photo of your leftover food. Our AI instantly checks if it's safe and lists it for pickup.",
    perks: [
      "AI food freshness check",
      "Auto-lists verified food",
      "Works for home leftovers",
      "No cooking experience needed",
    ],
    cta: "Join as Donor",
    border: "hover:border-emerald-300",
    glow: "hover:shadow-emerald-100",
    highlight: true,
  },
  {
    role: "admin",
    icon: ShieldCheck,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    badge: "Admin / Operator",
    title: "Monitor & Manage the Platform",
    desc: "Full visibility into escalations, agent activity, system health, and real-time operations.",
    perks: [
      "Live agent activity feed",
      "Escalation management",
      "System health map",
      "Test WhatsApp integration",
    ],
    cta: "Join as Admin",
    border: "hover:border-violet-300",
    glow: "hover:shadow-violet-100",
  },
];

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0faf6] via-white to-[#faf8f0] px-4 py-12">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-[#1D9E75] font-bold text-xl mb-8">
            <div className="h-9 w-9 rounded-xl bg-[#1D9E75] flex items-center justify-center">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            Prasadam
          </Link>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[#EF9F27]" />
            <p className="text-sm font-semibold text-[#EF9F27] uppercase tracking-widest">Choose your role</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
            How will you be part of<br />
            <span className="text-[#1D9E75]">the movement?</span>
          </h1>
          <p className="text-slate-500 mt-4 text-lg max-w-xl mx-auto">
            Pick the role that fits you. You can sign in with your phone number — no password needed.
          </p>
        </div>

        {/* 4 Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.role}
                href={`/login?role=${r.role}`}
                className={`group relative bg-white rounded-3xl border-2 border-slate-100 shadow-sm p-7 transition-all duration-200 ${r.border} ${r.glow} hover:shadow-lg hover:-translate-y-0.5`}
              >
                {r.highlight && (
                  <div className="absolute -top-3 left-6 bg-[#1D9E75] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI-powered
                  </div>
                )}

                <div className="flex items-start gap-4 mb-5">
                  <div className={`h-13 w-13 rounded-2xl flex items-center justify-center flex-shrink-0 p-3 ${r.iconBg}`}>
                    <Icon className={`h-6 w-6 ${r.iconColor}`} />
                  </div>
                  <div>
                    <span className={`text-xs font-semibold uppercase tracking-widest ${r.iconColor}`}>{r.badge}</span>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5 leading-snug">{r.title}</h2>
                  </div>
                </div>

                <p className="text-slate-500 text-sm mb-5 leading-relaxed">{r.desc}</p>

                <ul className="space-y-2 mb-6">
                  {r.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#1D9E75] flex-shrink-0" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <div className={`flex items-center gap-2 text-sm font-semibold ${r.iconColor} group-hover:gap-3 transition-all`}>
                  {r.cta} <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-slate-400 text-sm mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1D9E75] hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
