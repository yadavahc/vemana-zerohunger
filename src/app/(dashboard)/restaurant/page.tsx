"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useRestaurantListings } from "@/hooks/use-listings";
import { subscribeToRestaurantMatches, updateMatch, updateListing } from "@/lib/firebase/db";
import { handleRestaurantApproval } from "@/lib/agents/coordinator";
import { ImpactCounter } from "@/components/impact-counter";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "@/components/voice-button";
import MapComponent from "@/components/ui/map";
import { formatTimestamp, timeFromNow } from "@/lib/utils";
import { Package, CheckCircle, Clock, Plus, Bell, Zap, Volume2 } from "lucide-react";
import { useTranslation } from "@/context/language-context";
import Link from "next/link";
import type { Match } from "@/lib/types";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import toast from "react-hot-toast";
import { handleRestaurantVoiceIntent } from "@/lib/services/voice-intent-handlers";
import { VoiceIntentResult } from "@/lib/services/sarvam-ai";

export default function RestaurantDashboard() {
  const { appUser } = useAuth();
  const { t } = useTranslation();
  const { listings, loading } = useRestaurantListings(appUser?.uid);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    if (!appUser?.uid) return;
    const unsub = subscribeToRestaurantMatches(appUser.uid, setPendingMatches);
    return unsub;
  }, [appUser?.uid]);

  const available = listings.filter((l) => l.status === "available").length;
  const matched = listings.filter((l) => ["matched", "pending", "collected"].includes(l.status)).length;

  const mapMarkers = listings
    .filter(l => l.location?.latitude && l.location?.longitude)
    .map(l => ({
      id: l.id,
      lat: l.location!.latitude,
      lng: l.location!.longitude,
      title: `${l.totalServings} servings available`,
    }));

  async function toggleAutoApprove() {
    if (!appUser) return;
    setTogglingAuto(true);
    try {
      const next = !appUser.autoApprove;
      await updateDoc(doc(db, "users", appUser.uid), { autoApprove: next });
      toast.success(next ? "Auto-approve ON — agent will approve new requests instantly." : "Auto-approve OFF — you'll review each request manually.");
    } catch {
      toast.error("Failed to update setting.");
    } finally {
      setTogglingAuto(false);
    }
  }

  async function handleApproval(matchId: string, approved: boolean) {
    setApproving(matchId);
    try {
      await handleRestaurantApproval(matchId, approved, appUser!.uid);
      toast.success(approved ? "Request approved! Volunteer will be dispatched." : "Request declined.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setApproving(null);
    }
  }

  const handleVoiceIntent = (result: VoiceIntentResult) => {
    const handlers = {
      onApproveMatch: (matchId?: string) => {
        const match = pendingMatches[0];
        if (match || matchId) {
          handleApproval(match?.id || matchId!, true);
        } else {
          toast.error("No pending matches to approve");
        }
      },
      onDeclineMatch: (matchId?: string) => {
        const match = pendingMatches[0];
        if (match || matchId) {
          handleApproval(match?.id || matchId!, false);
        } else {
          toast.error("No pending matches to decline");
        }
      },
      onToggleAutoApprove: () => {
        toggleAutoApprove();
      },
      onCheckStatus: () => {
        toast.success(`${pendingMatches.length} matches pending approval, ${available} listings available`);
      },
    };

    const message = handleRestaurantVoiceIntent(result, handlers);
    toast.success(message);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {appUser?.orgName ?? appUser?.name}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{t("Dash.RestaurantSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {voiceEnabled && (
            <VoiceButton
              role="restaurant"
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
          <Link href="/restaurant/new-listing">
            <Button size="lg">
              <Plus className="h-4 w-4" />
              {t("Dash.AddSurplus")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ImpactCounter label={t("Dash.AvailableListings")} value={available} icon={<Package />} />
        <ImpactCounter label={t("Dash.MatchedCollected")} value={matched} icon={<CheckCircle />} color="text-emerald-600" />
        <ImpactCounter label={t("Dash.TotalListings")} value={listings.length} icon={<Clock />} color="text-blue-600" />
      </div>

      {/* Auto-approve toggle */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between ${appUser?.autoApprove ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${appUser?.autoApprove ? "bg-emerald-100" : "bg-slate-100"}`}>
            <Zap className={`h-5 w-5 ${appUser?.autoApprove ? "text-emerald-600" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{t("Dash.AutoApprove")}</p>
            <p className="text-xs text-slate-500">
              {appUser?.autoApprove ? t("Dash.AutoApproveOn") : t("Dash.AutoApproveOff")}
            </p>
          </div>
        </div>
        <button
          onClick={toggleAutoApprove}
          disabled={togglingAuto}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${appUser?.autoApprove ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${appUser?.autoApprove ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Pending approval requests */}
      {pendingMatches.length > 0 && (
        <Card className="border-[#EF9F27]/40 bg-amber-50/50">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#EF9F27]">
              <Bell className="h-5 w-5" />
              <h2 className="font-semibold text-slate-900">
                {t("Dash.ApprovalNeeded")} ({pendingMatches.length})
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-white rounded-xl p-4 border border-amber-100"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{match.ngoName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t("Dash.SLADeadline")} {timeFromNow(match.slaDeadline)}
                      </p>
                    </div>
                    <StatusBadge status={match.status} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(match.id, true)}
                      loading={approving === match.id}
                    >
                      {t("Dash.Approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproval(match.id, false)}
                      disabled={approving === match.id}
                    >
                      {t("Dash.Decline")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">{t("Dash.MyListings")}</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{t("Dash.NoListings")}</p>
                <Link href="/restaurant/new-listing">
                  <Button variant="outline" className="mt-4">{t("Dash.AddFirstListing")}</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-auto">
                {listings.map((listing) => (
                  <div key={listing.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={listing.status} />
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {listing.totalServings} {t("Dash.Servings")} ·{" "}
                        {listing.foodItems.map((f) => f.name).join(", ")}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t("Dash.Expires")} {timeFromNow(listing.expiryTime)}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">{formatTimestamp(listing.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">{t("Dash.ListingLocations")}</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
               <div className="h-[400px] bg-slate-100 rounded-xl animate-pulse w-full"></div>
            ) : (
                <MapComponent markers={mapMarkers} height="400px" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
