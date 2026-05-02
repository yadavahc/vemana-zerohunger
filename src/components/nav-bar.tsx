"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useTranslation } from "@/context/language-context";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { LogOut, Leaf } from "lucide-react";

interface NavLink {
  href: string;
  label: string;
}

const roleLinks: Record<string, NavLink[]> = {
  ngo: [
    { href: "/ngo", label: "Dashboard" },
    { href: "/ngo/request", label: "Request Food" },
    { href: "/ngo/history", label: "History" },
  ],
  restaurant: [
    { href: "/restaurant", label: "Dashboard" },
    { href: "/restaurant/listings", label: "My Listings" },
    { href: "/restaurant/new-listing", label: "Add Surplus" },
  ],
  volunteer: [
    { href: "/volunteer", label: "Dashboard" },
    { href: "/volunteer/deliveries", label: "My Deliveries" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/analytics", label: "Analytics" },
  ],
  donor: [
    { href: "/donor", label: "Donate Food" },
  ],
  beneficiary: [{ href: "/beneficiary", label: "Meals" }],
};

export function NavBar() {
  const { appUser, signOut } = useAuth();
  const { t } = useTranslation();
  const pathname = usePathname();
  const links = appUser ? roleLinks[appUser.role] ?? [] : [];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#1D9E75]">
            <Leaf className="h-5 w-5" />
            <span>Prasadam</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                  pathname === l.href
                    ? "bg-[#1D9E75]/10 text-[#1D9E75]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                {(() => {
                  const navKeyMap: Record<string, Parameters<typeof t>[0]> = {
                    "Dashboard": "Dashboard", "Overview": "Overview",
                    "Request Food": "Nav.RequestFood", "History": "Nav.History",
                    "My Listings": "Nav.MyListings", "Add Surplus": "Nav.AddSurplus",
                    "My Deliveries": "Nav.MyDeliveries", "Escalations": "Nav.Escalations",
                    "Analytics": "Nav.Analytics", "Donate Food": "Nav.DonateFood",
                  };
                  const key = navKeyMap[l.label];
                  return key ? t(key) : l.label;
                })()}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-32 mr-2">
            <LanguageSwitcher />
          </div>
          {appUser && <NotificationBell userId={appUser.uid} />}
          {appUser && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900 leading-none">{appUser.name}</p>
                <p className="text-xs text-slate-500 capitalize">{appUser.role}</p>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                title={t("Sign out")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
