"use client";

import { useEffect, useState } from "react";
import { subscribeToNotifications, markNotificationRead } from "@/lib/firebase/db";
import type { Notification } from "@/lib/types";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToNotifications(userId, (data) => {
      setNotifications(data);
      setUnread(data.filter((n) => !n.read).length);
    });
    return unsub;
  }, [userId]);

  async function markRead(id: string) {
    await markNotificationRead(id);
  }

  return { notifications, unread, markRead };
}
