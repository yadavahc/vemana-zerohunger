"use client";

import { useEffect, useState } from "react";
import {
  subscribeToVolunteerDeliveries,
  subscribeToOpenDeliveries,
} from "@/lib/firebase/db";
import type { Delivery } from "@/lib/types";

export function useVolunteerDeliveries(volunteerId: string | undefined) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!volunteerId) return;
    setLoading(true);
    const unsub = subscribeToVolunteerDeliveries(volunteerId, (data) => {
      setDeliveries(data);
      setLoading(false);
    });
    return unsub;
  }, [volunteerId]);

  return { deliveries, loading };
}

export function useOpenDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToOpenDeliveries((data) => {
      setDeliveries(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { deliveries, loading };
}
