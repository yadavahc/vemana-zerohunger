import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
import { UrgencyLevel } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ts.toDate());
}

export function timeFromNow(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const diff = ts.toDate().getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const past = diff < 0;

  if (mins < 1) return past ? "just now" : "in moments";
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
  if (hrs < 24) return past ? `${hrs}h ago` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return past ? `${days}d ago` : `in ${days}d`;
}

export function urgencyColor(level: UrgencyLevel): string {
  return {
    low: "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  }[level];
}

export function urgencyPriority(
  urgency: UrgencyLevel,
  beneficiaryCount: number,
  minutesUntilNeeded: number
): number {
  const urgencyWeight = { low: 1, medium: 2, high: 3, critical: 5 }[urgency];
  const timeWeight = Math.max(0, 1 - minutesUntilNeeded / (24 * 60));
  const beneficiaryWeight = Math.min(beneficiaryCount / 100, 1);
  return Math.round((urgencyWeight * 0.5 + timeWeight * 0.3 + beneficiaryWeight * 0.2) * 100);
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    matched: "Matched",
    approved: "Approved",
    dispatched: "Dispatched",
    delivered: "Delivered",
    failed: "Failed",
    available: "Available",
    collected: "Collected",
    expired: "Expired",
    pending_approval: "Awaiting Approval",
    rejected: "Rejected",
    completed: "Completed",
    finding_volunteer: "Finding Volunteer",
    assigned: "Volunteer Assigned",
    picked_up: "Picked Up",
    in_transit: "In Transit",
  };
  return labels[status] ?? status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    matched: "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    dispatched: "bg-violet-100 text-violet-700",
    delivered: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-700",
    available: "bg-teal-100 text-teal-700",
    collected: "bg-green-100 text-green-800",
    expired: "bg-gray-100 text-gray-500",
    pending_approval: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    completed: "bg-green-100 text-green-800",
    finding_volunteer: "bg-sky-100 text-sky-700",
    assigned: "bg-indigo-100 text-indigo-700",
    picked_up: "bg-purple-100 text-purple-700",
    in_transit: "bg-violet-100 text-violet-700",
  };
  return colors[status] ?? "bg-gray-100 text-gray-700";
}
