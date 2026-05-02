"use client";

import { useEffect, useState } from "react";
import {
  getAllRequests, getAllListings, getAllDeliveries, getAllMatches,
  getOpenEscalations,
} from "@/lib/firebase/db";
import type { FoodRequest, FoodListing, Delivery, Match, Escalation } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  TrendingUp, Package, CheckCircle, Truck, AlertTriangle,
  Users, Clock, Zap, ArrowLeft,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

// ── helpers ────────────────────────────────────────────────────────────────────
function dayLabel(ts?: Timestamp): string {
  if (!ts) return "?";
  const d = ts.toDate();
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function last7DayLabels(): string[] {
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  return labels;
}

function bucketByDay<T extends { createdAt?: Timestamp }>(items: T[], days: string[]): number[] {
  return days.map((label) =>
    items.filter((item) => {
      if (!item.createdAt) return false;
      return dayLabel(item.createdAt) === label;
    }).length
  );
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── simple bar chart ───────────────────────────────────────────────────────────
function BarChart({ data, labels, color = "#1D9E75" }: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-lg transition-all"
            style={{ height: `${(val / max) * 80}px`, backgroundColor: color, opacity: val === 0 ? 0.2 : 1 }}
          />
          <span className="text-[9px] text-slate-400 leading-none">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = "text-slate-700" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── alert panel ────────────────────────────────────────────────────────────────
function SmartAlerts({ listings, escalations }: {
  listings: FoodListing[];
  escalations: Escalation[];
}) {
  const now = Date.now();
  const expiringSoon = listings.filter((l) => {
    if (l.status !== "available") return false;
    const ms = l.expiryTime?.toMillis?.() ?? 0;
    return ms > now && ms - now < 60 * 60 * 1000; // expiring within 1h
  });

  const alerts: { type: "warn" | "danger"; msg: string }[] = [];

  if (expiringSoon.length > 0) {
    alerts.push({
      type: "warn",
      msg: `${expiringSoon.length} listing${expiringSoon.length > 1 ? "s" : ""} expiring within 1 hour with no match.`,
    });
  }
  if (escalations.length >= 5) {
    alerts.push({
      type: "danger",
      msg: `${escalations.length} open escalations — system needs attention.`,
    });
  }
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
        <CheckCircle className="h-4 w-4 flex-shrink-0" />
        All systems normal — no critical alerts.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl border ${
            a.type === "danger"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {a.msg}
        </div>
      ))}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllRequests(),
      getAllListings(),
      getAllDeliveries(),
      getAllMatches(),
      getOpenEscalations(),
    ]).then(([req, list, del, mat, esc]) => {
      setRequests(req);
      setListings(list);
      setDeliveries(del);
      setMatches(mat);
      setEscalations(esc);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const days = last7DayLabels();
  const reqByDay = bucketByDay(requests, days);
  const delByDay = bucketByDay(deliveries, days);
  const listByDay = bucketByDay(listings, days);

  const totalServings = deliveries
    .filter((d) => d.status === "delivered")
    .reduce((s, d) => {
      const match = matches.find((m) => m.id === d.matchId);
      const request = requests.find((r) => r.id === match?.requestId);
      return s + (request?.servingsNeeded ?? 0);
    }, 0);

  const matchRate = requests.length
    ? Math.round((requests.filter((r) => r.status !== "pending" && r.status !== "failed").length / requests.length) * 100)
    : 0;

  const deliverySuccessRate = deliveries.length
    ? Math.round((deliveries.filter((d) => d.status === "delivered").length / deliveries.length) * 100)
    : 0;

  const approvedMatches = matches.filter((m) => m.restaurantApprovalTime);
  const responseTimes = approvedMatches
    .map((m) => {
      const created = m.createdAt?.toMillis?.() ?? 0;
      const approved = m.restaurantApprovalTime?.toMillis?.() ?? 0;
      return approved > created ? Math.round((approved - created) / 60000) : null;
    })
    .filter((t): t is number => t !== null);
  const avgResponseMins = avg(responseTimes);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#1D9E75] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 rounded-xl hover:bg-slate-100 transition">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">System performance at a glance</p>
        </div>
      </div>

      {/* Smart alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-slate-900">Smart Alerts</h2>
          </div>
        </CardHeader>
        <CardContent>
          <SmartAlerts listings={listings} escalations={escalations} />
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Servings redistributed"
          value={totalServings.toLocaleString()}
          sub="across all deliveries"
          icon={<Users className="h-5 w-5" />}
          color="text-[#1D9E75]"
        />
        <StatCard
          label="Match rate"
          value={`${matchRate}%`}
          sub={`${requests.length} total requests`}
          icon={<TrendingUp className="h-5 w-5" />}
          color={matchRate >= 80 ? "text-emerald-600" : matchRate >= 50 ? "text-amber-600" : "text-red-600"}
        />
        <StatCard
          label="Delivery success"
          value={`${deliverySuccessRate}%`}
          sub={`${deliveries.length} total deliveries`}
          icon={<Truck className="h-5 w-5" />}
          color={deliverySuccessRate >= 80 ? "text-emerald-600" : "text-amber-600"}
        />
        <StatCard
          label="Avg response time"
          value={avgResponseMins > 0 ? `${avgResponseMins}m` : "—"}
          sub="restaurant approval"
          icon={<Clock className="h-5 w-5" />}
          color={avgResponseMins <= 5 ? "text-emerald-600" : avgResponseMins <= 10 ? "text-amber-600" : "text-red-600"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#EF9F27]" />
              Listings posted (7d)
            </h2>
          </CardHeader>
          <CardContent>
            <BarChart data={listByDay} labels={days} color="#EF9F27" />
            <p className="text-xs text-slate-400 mt-3 text-center">{listings.length} total listings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Requests received (7d)
            </h2>
          </CardHeader>
          <CardContent>
            <BarChart data={reqByDay} labels={days} color="#3b82f6" />
            <p className="text-xs text-slate-400 mt-3 text-center">{requests.length} total requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#1D9E75]" />
              Deliveries completed (7d)
            </h2>
          </CardHeader>
          <CardContent>
            <BarChart data={delByDay} labels={days} color="#1D9E75" />
            <p className="text-xs text-slate-400 mt-3 text-center">{deliveries.filter((d) => d.status === "delivered").length} delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900 text-sm">Request breakdown</h2>
          </CardHeader>
          <CardContent>
            {(["pending", "matched", "approved", "dispatched", "delivered", "failed"] as const).map((status) => {
              const count = requests.filter((r) => r.status === status).length;
              const pct = requests.length ? Math.round((count / requests.length) * 100) : 0;
              const color = {
                pending: "bg-slate-300",
                matched: "bg-blue-400",
                approved: "bg-indigo-400",
                dispatched: "bg-amber-400",
                delivered: "bg-emerald-500",
                failed: "bg-red-400",
              }[status];
              return (
                <div key={status} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-500 w-20 capitalize">{status}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900 text-sm">Listing breakdown</h2>
          </CardHeader>
          <CardContent>
            {(["available", "pending", "matched", "collected", "expired"] as const).map((status) => {
              const count = listings.filter((l) => l.status === status).length;
              const pct = listings.length ? Math.round((count / listings.length) * 100) : 0;
              const color = {
                available: "bg-emerald-500",
                pending: "bg-amber-400",
                matched: "bg-blue-400",
                collected: "bg-indigo-400",
                expired: "bg-red-400",
              }[status];
              return (
                <div key={status} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-500 w-20 capitalize">{status}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
