"use client";

import { useAuth } from "@/context/auth-context";
import { useVolunteerDeliveries, useOpenDeliveries } from "@/hooks/use-deliveries";
import { assignVolunteer, updateDeliveryProgress } from "@/lib/agents/dispatch";
import { ImpactCounter } from "@/components/impact-counter";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "@/components/voice-button";
import { formatTimestamp } from "@/lib/utils";
import { Truck, CheckCircle, MapPin, Camera, ShieldCheck, AlertTriangle, Volume2, Clock, Navigation } from "lucide-react";
import { useTranslation } from "@/context/language-context";
import { useDeliveryETA } from "@/hooks/use-delivery-eta";
import type { Delivery } from "@/lib/types";
import toast from "react-hot-toast";
import { useState, useRef } from "react";
import MapComponent from "@/components/ui/map";
import { storage } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { handleVolunteerVoiceIntent } from "@/lib/services/voice-intent-handlers";
import { VoiceIntentResult } from "@/lib/services/sarvam-ai";

function DeliveryCard({
  delivery,
  onAction,
  isOwn,
  volunteerId,
  volunteerName,
  volunteerPhone,
}: {
  delivery: Delivery;
  onAction: () => void;
  isOwn: boolean;
  volunteerId?: string;
  volunteerName?: string;
  volunteerPhone?: string;
}) {
  const [loading, setLoading] = useState(false);
  const eta = useDeliveryETA(
    isOwn && delivery.status !== "delivered" ? delivery.pickupAddress : undefined,
    isOwn && delivery.status !== "delivered" ? delivery.dropAddress : undefined
  );

  const nextStatus: Record<string, Delivery["status"]> = {
    assigned: "picked_up",
    picked_up: "in_transit",
    in_transit: "delivered",
  };

  const { t } = useTranslation();
  const actionLabel: Record<string, string> = {
    finding_volunteer: t("Dash.AcceptDelivery"),
    assigned: t("Dash.MarkPickedUp"),
    picked_up: t("Dash.MarkInTransit"),
    in_transit: t("Dash.MarkDelivered"),
  };

  async function handleAction() {
    setLoading(true);
    try {
      if (delivery.status === "finding_volunteer" && volunteerId && volunteerName && volunteerPhone) {
        await assignVolunteer(delivery.id, volunteerId, volunteerName, volunteerPhone);
        toast.success("Delivery accepted!");
      } else if (nextStatus[delivery.status]) {
        const extras =
          delivery.status === "in_transit"
            ? { completedAt: (await import("firebase/firestore")).Timestamp.now() }
            : {};
        await updateDeliveryProgress(delivery.id, nextStatus[delivery.status], extras);
        toast.success("Status updated!");
      }
      onAction();
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setLoading(false);
    }
  }

  const canAct =
    (delivery.status === "finding_volunteer" && !isOwn) ||
    (isOwn && delivery.status !== "delivered" && delivery.status !== "finding_volunteer");

  // Photo upload + quality check (shown when picked_up)
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [qualityResult, setQualityResult] = useState<{
    passed: boolean;
    recommendation: string;
  } | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !volunteerId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `quality-checks/${delivery.id}/${Date.now()}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);

      const res = await fetch("/api/agents/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: delivery.id, imageUrl, volunteerId }),
      });
      const data = await res.json();
      setQualityResult({ passed: data.passed, recommendation: data.recommendation });
      toast.success(data.passed ? "Food quality approved!" : "Quality issue detected — check details.");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex justify-between items-start mb-3">
        <StatusBadge status={delivery.status} />
        <span className="text-xs text-slate-400">{formatTimestamp(delivery.createdAt)}</span>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <div className="mt-1 h-2 w-2 rounded-full bg-[#EF9F27] flex-shrink-0" />
          <p className="text-sm text-slate-700">{delivery.pickupAddress}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="mt-1 h-2 w-2 rounded-full bg-[#1D9E75] flex-shrink-0" />
          <p className="text-sm text-slate-700">{delivery.dropAddress}</p>
        </div>
        {/* ETA row */}
        {isOwn && delivery.status !== "delivered" && (
          <div className="flex items-center gap-3 mt-1 pt-2 border-t border-slate-100">
            {eta.loading ? (
              <span className="text-xs text-slate-400">Calculating route…</span>
            ) : eta.error ? null : (
              <>
                <span className="flex items-center gap-1 text-xs font-medium text-[#1D9E75]">
                  <Clock className="h-3.5 w-3.5" />
                  {eta.duration}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Navigation className="h-3.5 w-3.5" />
                  {eta.distance}
                </span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(delivery.pickupAddress)}&destination=${encodeURIComponent(delivery.dropAddress)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-blue-600 hover:underline"
                >
                  Open in Maps →
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quality check UI — shown after pickup */}
      {isOwn && delivery.status === "picked_up" && (
        <div className="mb-3 rounded-xl bg-amber-50 border border-amber-100 p-3">
          <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> {t("Dash.QualityCheck")}
          </p>
          {qualityResult ? (
            <div className={`flex items-start gap-2 text-xs ${qualityResult.passed ? "text-emerald-700" : "text-red-700"}`}>
              {qualityResult.passed
                ? <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
              <span>{qualityResult.recommendation}</span>
            </div>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handlePhotoUpload} />
              <Button size="sm" variant="outline" loading={uploading}
                onClick={() => fileRef.current?.click()} className="w-full text-xs">
                <Camera className="h-3.5 w-3.5" />
                {uploading ? t("Dash.AnalysingAI") : t("Dash.PhotoQualityCheck")}
              </Button>
            </>
          )}
        </div>
      )}

      {canAct && (
        <Button size="sm" className="w-full" onClick={handleAction} loading={loading}>
          {actionLabel[delivery.status] ?? "Update"}
        </Button>
      )}
    </div>
  );
}

export default function VolunteerDashboard() {
  const { appUser } = useAuth();
  const { t } = useTranslation();
  const { deliveries: myDeliveries, loading: myLoading } = useVolunteerDeliveries(appUser?.uid);
  const { deliveries: openDeliveries } = useOpenDeliveries();
  const [tick, setTick] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const completed = myDeliveries.filter((d) => d.status === "delivered").length;
  const active = myDeliveries.filter((d) => d.status !== "delivered").length;

  const mapMarkers = [...openDeliveries, ...myDeliveries]
    .filter((d: any) => d.location?.latitude && d.location?.longitude)
    .map((d: any) => ({
      id: d.id,
      lat: d.location.latitude,
      lng: d.location.longitude,
      title: `Delivery: ${d.pickupAddress}`,
    }));

  const handleVoiceIntent = (result: VoiceIntentResult) => {
    const handlers = {
      onAcceptDelivery: (deliveryId?: string) => {
        const delivery = openDeliveries[0];
        if (delivery || deliveryId) {
          // Trigger the card's action
          toast.success("Accepting delivery...");
          setTick(prev => prev + 1);
        } else {
          toast.error("No deliveries available to accept");
        }
      },
      onMarkPickedUp: () => {
        toast.success("Marking as picked up...");
        setTick(prev => prev + 1);
      },
      onMarkInTransit: () => {
        toast.success("Marking as in transit...");
        setTick(prev => prev + 1);
      },
      onMarkDelivered: () => {
        toast.success("Marking as delivered...");
        setTick(prev => prev + 1);
      },
      onStartPickups: () => {
        toast.success("Starting delivery route...");
      },
      onCheckStatus: () => {
        toast.success(`${active} active deliveries, ${completed} completed`);
      },
    };

    const message = handleVolunteerVoiceIntent(result, handlers);
    toast.success(message);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t("Donor.Hello")} {appUser?.name}!
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{t("Dash.VolunteerSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {voiceEnabled && (
            <VoiceButton
              role="volunteer"
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImpactCounter label={t("Dash.ActiveDeliveries")} value={active} icon={<Truck />} />
        <ImpactCounter label={t("Dash.Completed")} value={completed} icon={<CheckCircle />} color="text-emerald-600" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">{t("Dash.MapTracking")}</h2>
        </CardHeader>
        <CardContent>
          <MapComponent markers={mapMarkers} height="400px" />
        </CardContent>
      </Card>

      {/* Open deliveries available to accept */}
      {openDeliveries.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#EF9F27]" />
            {t("Dash.AvailablePickups")} ({openDeliveries.length})
          </h2>
          <div className="grid gap-3">
            {openDeliveries.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                onAction={() => setTick((prev) => prev + 1)}
                isOwn={false}
                volunteerId={appUser?.uid}
                volunteerName={appUser?.name}
                volunteerPhone={appUser?.phone}
              />
            ))}
          </div>
        </div>
      )}

      {/* My active deliveries */}
      <div>
        <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-[#1D9E75]" />
          {t("Dash.MyDeliveries")}
        </h2>
        {myLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : myDeliveries.length === 0 ? (
          <Card>
            <CardContent className="pt-5 text-center py-12">
              <Truck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t("Dash.NoDeliveries")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {myDeliveries.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                onAction={() => setTick((prev) => prev + 1)}
                isOwn={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
