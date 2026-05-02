"use client";

import { useEffect, useState } from "react";
import {
  subscribeToEscalations,
  subscribeToAgentLogs,
  updateEscalation,
  getPendingRequests,
  getAvailableListings,
} from "@/lib/firebase/db";
import type { AgentLog } from "@/lib/firebase/db";
import { ImpactCounter } from "@/components/impact-counter";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import MapComponent from "@/components/ui/map";
import { formatTimestamp, timeFromNow } from "@/lib/utils";
import {
  AlertTriangle, Package, Users, Activity, CheckCircle,
  Bot, Truck, ShieldCheck, Bell, TrendingUp, Zap, MessageCircle, Volume2,
} from "lucide-react";
import type { Escalation, FoodRequest, FoodListing } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { handleAdminVoiceIntent } from "@/lib/services/voice-intent-handlers";
import { VoiceIntentResult } from "@/lib/services/sarvam-ai";
import { useTranslation } from "@/context/language-context";
import { VoiceAssistant as VoiceButton } from "@/components/voice-assistant";

const escalationLabels: Record<string, string> = {
  no_restaurant_response: "Restaurant no response",
  volunteer_no_show: "Volunteer no-show",
  food_expiring: "Food expiring",
  quality_fail: "Quality check failed",
};

type AgentMeta = { label: string; color: string };
const AGENT_META: Record<string, AgentMeta> = {
  coordinator:   { label: "Coordinator", color: "bg-violet-100 text-violet-700 border-violet-200" },
  supply:        { label: "Supply",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  dispatch:      { label: "Dispatch",    color: "bg-amber-100 text-amber-700 border-amber-200" },
  escalation:    { label: "Escalation",  color: "bg-red-100 text-red-700 border-red-200" },
  quality_check: { label: "Quality",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  notification:  { label: "Notify",      color: "bg-pink-100 text-pink-700 border-pink-200" },
  prediction:    { label: "Prediction",  color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
};

function agentTimestamp(ts?: Timestamp): string {
  const ms = ts?.toMillis?.();
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [escalations, setEscalations] = useState<Escalation[]>([
    {
      id: "esc_1",
      reason: "no_restaurant_response",
      requestId: "req_abc",
      listingId: "list_xyz",
      status: "open",
      createdAt: Timestamp.fromMillis(Date.now() - 30 * 60 * 1000),
      details: "Restaurant 'Tasty Bites' did not respond to a match for 30 minutes.",
    },
    {
      id: "esc_2",
      reason: "volunteer_no_show",
      deliveryId: "del_123",
      status: "open",
      createdAt: Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000),
      details: "Volunteer 'Ravi Kumar' did not confirm pickup after 1 hour.",
    },
  ]);
  const [pendingRequests, setPendingRequests] = useState<FoodRequest[]>([]);
  const [availableListings, setAvailableListings] = useState<FoodListing[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([
    {
      id: "log_1",
      agent: "coordinator",
      action: "match_found",
      timestamp: Timestamp.fromMillis(Date.now() - 5 * 60 * 1000),
      decision: "Matched NGO 'Good Works' with 'Pizza Place' for 20 servings.",
      durationMs: 150,
    },
    {
      id: "log_2",
      agent: "dispatch",
      action: "volunteer_assigned",
      timestamp: Timestamp.fromMillis(Date.now() - 10 * 60 * 1000),
      decision: "Assigned delivery 'del_456' to volunteer 'Sunita P'.",
      durationMs: 80,
    },
    {
      id: "log_3",
      agent: "supply",
      action: "score_listing",
      timestamp: Timestamp.fromMillis(Date.now() - 12 * 60 * 1000),
      decision: "Scored new listing 'list_pqr' with a high relevance of 0.92.",
      durationMs: 220,
    },
    {
      id: "log_4",
      agent: "escalation",
      action: "create_escalation",
      timestamp: Timestamp.fromMillis(Date.now() - 30 * 60 * 1000),
      decision: "Created escalation for non-responsive restaurant 'Tasty Bites'.",
      durationMs: 50,
    },
  ]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [testingWA, setTestingWA] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    // NOTE: Real-time subscriptions are disabled to show dummy data.
    // To re-enable, uncomment the following lines and remove the initial dummy data above.
    /*
    const unsub = subscribeToEscalations(setEscalations, (err) => {
      console.error("[Escalations]", err);
      toast.error("Could not load escalations.");
    });
    return unsub;
    */
  }, []);

  useEffect(() => {
    /*
    const unsub = subscribeToAgentLogs(setAgentLogs, (err) => {
      console.error("[AgentLogs]", err);
      toast.error("Could not load agent logs.");
    });
    return unsub;
    */
  }, []);

  useEffect(() => {
    getPendingRequests().then(setPendingRequests).catch(() => {});
    getAvailableListings().then(setAvailableListings).catch(() => {});
  }, []);

  async function testWhatsApp() {
    setTestingWA(true);
    try {
      const res = await fetch("/api/whatsapp/test");
      const data = await res.json();
      if (data.success) {
        toast.success("WhatsApp test message sent! Check your phone.");
      } else {
        const errorMessage = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error ?? data.reason ?? "unknown");
        toast.error(`WhatsApp error: ${errorMessage}`);
      }
    } catch {
      toast.error("Could not reach WhatsApp API.");
    } finally {
      setTestingWA(false);
    }
  }

  async function resolveEscalation(id: string, adminNote: string) {
    setResolving(id);
    try {
      // Simulate a successful API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the local state to reflect the change
      setEscalations(prev => 
        prev.map(e => e.id === id ? { ...e, status: "resolved", adminNote, resolvedBy: "admin" } : e)
      );
      
      toast.success("Escalation resolved.");
    } catch {
      toast.error("Failed to resolve.");
    } finally {
      setResolving(null);
    }
  }

  const handleVoiceIntent = (result: VoiceIntentResult) => {
    const handlers = {
      onShowStats: () => {
        toast.success(`${pendingRequests.length} pending requests, ${availableListings.length} available listings, ${escalations.length} escalations`);
      },
      onListEscalations: () => {
        if (escalations.length === 0) {
          toast.success("No escalations. System running smoothly.");
        } else {
          toast.success(`${escalations.length} escalations to review`);
        }
      },
      onResolveEscalation: (escalationId?: string) => {
        const escalation = escalations[0];
        if (escalation || escalationId) {
          resolveEscalation(escalation?.id || escalationId!, "Resolved by voice command");
        } else {
          toast.error("No escalations to resolve");
        }
      },
      onCheckStatus: () => {
        toast.success(`System Live - ${agentLogs.length} agent events`);
      },
    };

    const message = handleAdminVoiceIntent(result, handlers);
    toast.success(message);
  };

  const openCount = escalations.length;

  const mapMarkers = [
    ...pendingRequests
      .filter((r) => (r as any).location?.latitude && (r as any).location?.longitude)
      .map((r) => ({
        id: `req-${r.id}`,
        lat: (r as any).location.latitude,
        lng: (r as any).location.longitude,
        title: `Request: ${r.ngoName} (${r.servingsNeeded} servings)`,
      })),
    ...availableListings
      .filter((l) => (l as any).location?.latitude && (l as any).location?.longitude)
      .map((l) => ({
        id: `list-${l.id}`,
        lat: (l as any).location.latitude,
        lng: (l as any).location.longitude,
        title: `Listing: ${l.restaurantName} (${l.totalServings} servings)`,
      })),
  ];

  const visibleLogs = logsExpanded ? agentLogs : agentLogs.slice(0, 15);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Admin.Operations")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t("Admin.SystemHealth")}</p>
        </div>
        <div className="flex items-center gap-2">
          {voiceEnabled && (
            <VoiceButton
              role="admin"
              onIntentDetected={handleVoiceIntent}
              onError={(error) => toast.error(error)}
            />
          )}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              voiceEnabled ? "bg-[#1D9E75] text-white" : "bg-slate-200 text-slate-600"
            }`}
            title="Toggle voice input"
          >
            <Volume2 className="h-5 w-5" />
          </button>
          <Button size="sm" variant="outline" onClick={testWhatsApp} loading={testingWA}>
            <MessageCircle className="h-4 w-4" />
            {t("Admin.TestWhatsApp")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ImpactCounter
          label={t("Admin.OpenEscalations")}
          value={openCount}
          icon={<AlertTriangle />}
          color={openCount > 0 ? "text-red-600" : "text-emerald-600"}
        />
        <ImpactCounter label={t("Admin.PendingRequests")}  value={pendingRequests.length}  icon={<Users />}    color="text-blue-600" />
        <ImpactCounter label={t("Admin.AvailableSupply")}  value={availableListings.length} icon={<Package />}  color="text-[#1D9E75]" />
        <ImpactCounter label={t("Admin.SystemStatus")}     value="Live"                     icon={<Activity />} color="text-emerald-600" />
      </div>

      {/* Escalations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="font-semibold text-slate-900">{t("Admin.Escalations")}</h2>
            </div>
            {openCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {openCount} open
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {escalations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No escalations. System running smoothly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {escalations.map((esc) => (
                <div
                  key={esc.id}
                  className="rounded-xl border border-red-100 bg-red-50/50 p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {escalationLabels[esc.type] ?? esc.type}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Attempts: {esc.attempts} · {formatTimestamp(esc.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={esc.status} />
                  </div>
                  {esc.matchId && (
                    <p className="text-xs text-slate-500 mb-3">Match: {esc.matchId}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveEscalation(esc.id, "Resolved by admin")}
                    loading={resolving === esc.id}
                  >
                    {t("Admin.MarkResolved")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-500" />
              <h2 className="font-semibold text-slate-900">{t("Admin.AgentActivity")}</h2>
              {agentLogs.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Live
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{agentLogs.length} events</span>
          </div>
        </CardHeader>
        <CardContent>
          {agentLogs.length === 0 ? (
            <div className="text-center py-10">
              <Zap className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{t("Admin.NoActivity")}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(AGENT_META).map(([key, meta]) => {
                  const count = agentLogs.filter((l) => l.agent === key).length;
                  if (count === 0) return null;
                  return (
                    <span
                      key={key}
                      className={`text-xs font-medium px-2 py-1 rounded-full border ${meta.color}`}
                    >
                      {meta.label}: {count}
                    </span>
                  );
                })}
              </div>

              {/* Log rows */}
              <div className="space-y-1.5 max-h-[420px] overflow-auto">
                {visibleLogs.map((log) => {
                  const meta = AGENT_META[log.agent] ?? {
                    label: log.agent,
                    color: "bg-slate-100 text-slate-600 border-slate-200",
                  };
                  return (
                    <div key={log.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800">
                          {log.action.replace(/_/g, " ")}
                        </p>
                        {log.context && Object.keys(log.context).length > 0 && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {Object.entries(log.context)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {agentTimestamp(log.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {agentLogs.length > 15 && (
                <button
                  onClick={() => setLogsExpanded((x) => !x)}
                  className="mt-3 text-xs text-[#1D9E75] hover:underline w-full text-center"
                >
                  {logsExpanded ? t("Admin.ShowLess") : `${t("Admin.ShowAll")} ${agentLogs.length} events`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map + Unmatched Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">{t("Admin.SystemMap")}</h2>
          </CardHeader>
          <CardContent>
            <MapComponent markers={mapMarkers} height="400px" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">
              {t("Admin.UnmatchedRequests")} ({pendingRequests.length})
            </h2>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t("Admin.AllMatched")}</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-auto">
                {pendingRequests.slice(0, 10).map((req) => (
                  <div key={req.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{req.ngoName}</p>
                      <p className="text-xs text-slate-500">
                        {req.servingsNeeded} servings · {req.urgency} urgency · {req.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      <span className="text-xs text-slate-400">{timeFromNow(req.neededBy)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
