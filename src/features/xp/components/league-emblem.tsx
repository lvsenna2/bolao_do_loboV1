import { Award, Crown, Medal, Shield, Star, Target, Trophy } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type LeagueEmblemView = {
  badge: {
    title: string;
  };
  championship: {
    name: string;
  };
  customTitle: string | null;
  emblemColor: string;
  emblemIcon: string;
  emblemStyle: string;
  id: string;
};

type LeagueEmblemProps = {
  className?: string;
  compact?: boolean;
  emblem: LeagueEmblemView;
};

const iconMap = {
  AWARD: Award,
  CROWN: Crown,
  MEDAL: Medal,
  SHIELD: Shield,
  STAR: Star,
  TARGET: Target,
  TROPHY: Trophy
} as const;

const styleClass = {
  MEDAL: "rounded-full border-double border-[3px]",
  RIBBON: "rounded-sm border-b-4",
  SEAL: "rounded-full border-2 ring-2 ring-current ring-offset-2 ring-offset-app-background",
  SHIELD: "rounded-t-md rounded-b-xl border-2"
} as const;

function safeColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value) ? value : "#F4B41A";
}

export function LeagueEmblem({ className, compact = false, emblem }: LeagueEmblemProps) {
  const color = safeColor(emblem.emblemColor);
  const Icon = iconMap[emblem.emblemIcon as keyof typeof iconMap] ?? Trophy;
  const title = emblem.customTitle || emblem.badge.title;
  const shape = styleClass[emblem.emblemStyle as keyof typeof styleClass] ?? styleClass.MEDAL;
  const css = {
    backgroundColor: `${color}1F`,
    borderColor: color,
    color
  } satisfies CSSProperties;

  return (
    <span
      aria-label={`${title}, ${emblem.championship.name}`}
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
      title={`${title} - ${emblem.championship.name}`}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center shadow-[0_0_14px_rgba(244,180,26,0.18)]",
          compact ? "h-7 w-7" : "h-11 w-11",
          shape
        )}
        style={css}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} strokeWidth={2.2} />
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-app-foreground">{title}</span>
          <span className="block truncate text-[11px] text-app-muted">
            {emblem.championship.name}
          </span>
        </span>
      )}
    </span>
  );
}

export function LeagueEmblemList({ emblems }: { emblems: LeagueEmblemView[] }) {
  if (emblems.length === 0) {
    return null;
  }

  return (
    <div aria-label="Insignias conquistadas" className="mt-2 flex flex-wrap items-center gap-1.5">
      {emblems.slice(0, 4).map((emblem) => (
        <LeagueEmblem compact emblem={emblem} key={emblem.id} />
      ))}
      {emblems.length > 4 ? (
        <span className="text-[11px] font-medium text-app-muted">+{emblems.length - 4}</span>
      ) : null}
    </div>
  );
}
