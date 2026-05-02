"use client";

import { useEffect, useState } from "react";
import {
  subscribeToEscalations,
  updateEscalation,
} from "@/lib/firebase/db";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTimestamp, timeFromNow } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { Escalation } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { useTranslation } from "@/context/language-context";

const escalationLabels: Record<string, string> = {
  no_restaurant_response: "Restaurant No Response",
  volunteer_no_show: "Volunteer No-Show",
  food_expiring: "Food Expiring",
  quality_fail: "Quality Check Failed",
};

export default function EscalationsPage() {
  const { t } = useTranslation();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToEscalations(
      (data) => {
        setEscalations(data);
        setLoading(false);
      },
      (err) => {
        console.error("[Escalations]", err);
        toast.error("Could not load escalations.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  async function resolveEscalation(id: string, adminNote: string) {
    setResolving(id);
    try {
      await updateEscalation(id, {
        status: "resolved",
        adminNote,
        resolvedBy: "admin",
      });
      toast.success("Escalation resolved.");
    } catch {
      toast.error("Failed to resolve.");
    } finally {
      setResolving(null);
    }
  }

  const openEscalations = escalations.filter((e) => e.status === "open");
  const resolvedEscalations = escalations.filter((e) => e.status === "resolved");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          System Escalations
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Review and resolve issues requiring manual intervention.
        </p>
      </div>

      {loading && <p>Loading escalations...</p>}

      {!loading && escalations.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No Escalations
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            The system is running smoothly.
          </p>
        </div>
      )}

      {openEscalations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Open Escalations ({openEscalations.length})
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {openEscalations.map((esc) => (
              <div
                key={esc.id}
                className="p-4 rounded-lg border bg-white flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold">
                    {escalationLabels[esc.reason] || "Unknown Issue"}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{esc.details}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {formatTimestamp(esc.createdAt)} ({timeFromNow(esc.createdAt)})
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => resolveEscalation(esc.id, "Resolved by admin.")}
                  loading={resolving === esc.id}
                >
                  Mark as Resolved
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {resolvedEscalations.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              Resolved Escalations ({resolvedEscalations.length})
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolvedEscalations.map((esc) => (
              <div
                key={esc.id}
                className="p-4 rounded-lg border bg-slate-50 flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-600">
                    {escalationLabels[esc.reason] || "Unknown Issue"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{esc.details}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Resolved {timeFromNow(esc.resolvedAt || esc.createdAt)}
                  </p>
                </div>
                <StatusBadge status="resolved" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
