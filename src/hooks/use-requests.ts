"use client";

import { useEffect, useState } from "react";
import { subscribeToRequests } from "@/lib/firebase/db";
import type { FoodRequest } from "@/lib/types";

export function useNgoRequests(ngoId: string | undefined) {
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ngoId) return;
    setLoading(true);
    const unsub = subscribeToRequests(ngoId, (data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsub;
  }, [ngoId]);

  return { requests, loading };
}
