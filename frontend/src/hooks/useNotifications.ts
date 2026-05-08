"use client";
import { useEffect, useRef, useCallback } from "react";
import { useComposterStore } from "@/store/composterStore";
import { getSettings, getNotifications, NotificationType } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

function typeEmoji(type: NotificationType): string {
  switch (type) {
    case "alert":    return "🚨";
    case "warning":  return "⚠️";
    case "schedule": return "📅";
    case "device":   return "�";
    case "system":   return "⚙️";
    default:         return "ℹ️";
  }
}

export function useNotifications() {
  const lastEvent  = useComposterStore((s) => s.state.lastEvent);
  const wifiStatus = useComposterStore((s) => s.state.wifi);

  const seenIdsRef     = useRef<Set<string> | null>(null);
  const pushEnabledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    getSettings()
      .then((s) => { pushEnabledRef.current = s.notify_push; })
      .catch(() => {});
  }, []);

  const checkNewNotifications = useCallback(async () => {
    if (!pushEnabledRef.current) return;
    if (Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;

    try {
      const notifications = await getNotifications({ unreadOnly: true, limit: 20 });

      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(notifications.map((n) => n.id));
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      for (const n of notifications) {
        if (!seenIdsRef.current.has(n.id)) {
          seenIdsRef.current.add(n.id);
          reg.showNotification(`${typeEmoji(n.type)} ${n.title}`, {
            body: n.message,
            icon: "/compost-icon.png",
            badge: "/compost-icon.png",
            tag: n.id,
          } as NotificationOptions);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkNewNotifications();
    const t = setInterval(checkNewNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [checkNewNotifications]);

  useEffect(() => { checkNewNotifications(); }, [lastEvent, wifiStatus, checkNewNotifications]);
}
