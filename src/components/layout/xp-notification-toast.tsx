"use client";

import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  Crosshair,
  Flame,
  Gift,
  Medal,
  Settings,
  Sparkles,
  Target,
  Trophy,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type XpToastNotification = {
  createdAt: string;
  icon: string | null;
  id: string;
  levelAfter: number | null;
  message: string | null;
  title: string;
  uniqueKey: string | null;
  xpReceived: number | null;
};

const iconMap = {
  award: Award,
  "calendar-check": CalendarCheck,
  "clipboard-check": ClipboardCheck,
  crosshair: Crosshair,
  flame: Flame,
  gift: Gift,
  medal: Medal,
  settings: Settings,
  sparkles: Sparkles,
  target: Target,
  trophy: Trophy
};

function getIcon(icon: string | null) {
  return iconMap[icon as keyof typeof iconMap] ?? Sparkles;
}

function getStorageKey(notification: XpToastNotification) {
  return `xp-toast:${notification.uniqueKey ?? notification.id}`;
}

export function XpNotificationToast() {
  const [notification, setNotification] = useState<XpToastNotification | null>(null);
  const visibleNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkLatestXpNotification() {
      try {
        const response = await fetch("/api/notifications/xp-toast", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          notification: XpToastNotification | null;
        };

        if (!data.notification || cancelled) {
          return;
        }

        const storageKey = getStorageKey(data.notification);

        if (
          visibleNotificationRef.current === storageKey ||
          sessionStorage.getItem(storageKey) === "shown"
        ) {
          return;
        }

        sessionStorage.setItem(storageKey, "shown");
        visibleNotificationRef.current = storageKey;
        setNotification(data.notification);
      } catch {
        // Toast is best-effort; the notification remains saved in the central list.
      }
    }

    void checkLatestXpNotification();

    const interval = window.setInterval(checkLatestXpNotification, 8000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkLatestXpNotification();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotification(null);
    }, 5200);

    return () => window.clearTimeout(timeout);
  }, [notification]);

  if (!notification) {
    return null;
  }

  const Icon = getIcon(notification.icon);

  return (
    <div
      aria-live="polite"
      className="xp-toast fixed right-4 top-20 z-50 w-[min(calc(100vw-2rem),360px)] rounded-card border border-brand-gold/40 bg-black/95 p-4 text-white shadow-soft backdrop-blur"
      role="status"
    >
      <div className="flex gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-brand-gold text-slate-950">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{notification.title}</p>
            <button
              aria-label="Fechar notificacao de XP"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setNotification(null)}
              type="button"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-sm text-amber-50/80">{notification.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {notification.xpReceived !== null ? (
              <span className="rounded-full bg-brand-gold px-2 py-1 text-xs font-bold text-slate-950">
                {notification.xpReceived >= 0 ? "+" : ""}
                {notification.xpReceived} XP
              </span>
            ) : null}
            {notification.levelAfter ? (
              <span className="rounded-full border border-white/20 px-2 py-1 text-xs font-semibold text-white/85">
                Patente {notification.levelAfter}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
