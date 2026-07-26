"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) return "Encerrado";
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}min`;
}

export function SpecialRoundCountdown({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState(() => new Date(closesAt).getTime() - Date.now());
  useEffect(() => {
    const timer = window.setInterval(
      () => setRemaining(new Date(closesAt).getTime() - Date.now()),
      30_000
    );
    return () => window.clearInterval(timer);
  }, [closesAt]);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-app-muted">
      <Clock3 className="h-4 w-4 text-brand-gold" /> Fecha em {formatRemaining(remaining)}
    </span>
  );
}
