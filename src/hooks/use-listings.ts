"use client";

import { useEffect, useState } from "react";
import { subscribeToListings } from "@/lib/firebase/db";
import type { FoodListing } from "@/lib/types";

export function useRestaurantListings(restaurantId: string | undefined) {
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    const unsub = subscribeToListings(restaurantId, (data) => {
      setListings(data);
      setLoading(false);
    });
    return unsub;
  }, [restaurantId]);

  return { listings, loading };
}
