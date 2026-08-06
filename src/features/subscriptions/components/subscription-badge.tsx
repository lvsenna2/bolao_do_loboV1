import type { SubscriptionPlan } from "@prisma/client";
import { Gem, Medal, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { getPlanConfig } from "../config";

const planStyles: Record<SubscriptionPlan, string> = {
  PLATINUM: "border-cyan-300/50 bg-cyan-300/10 text-cyan-100",
  OURO: "border-brand-gold/55 bg-brand-gold/10 text-brand-gold",
  PRATA: "border-slate-300/45 bg-slate-300/10 text-slate-200"
};

const planIcons = {
  PLATINUM: Gem,
  OURO: Sparkles,
  PRATA: Medal
} as const;

export function SubscriptionBadge({ plan }: { plan: SubscriptionPlan | null }) {
  if (!plan) return null;
  const Icon = planIcons[plan];

  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        planStyles[plan]
      )}
      title={`Assinante ${getPlanConfig(plan).name}`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {getPlanConfig(plan).benefits.badge}
    </span>
  );
}
