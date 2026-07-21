import Image from "next/image";
import type { CSSProperties } from "react";

import {
  resolveLeagueEmblem,
  type OfficialLeagueEmblem
} from "@/features/xp/constants/league-emblems";
import { cn } from "@/lib/utils";

const SOURCE_WIDTH = 1536;
const SOURCE_HEIGHT = 1024;
const EMBLEM_SPRITE = "/brand/emblems/catalogo-oficial.png";

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
  emblemKey?: string | null;
  emblemStyle: string;
  id: string;
  isUniversal?: boolean;
};

type LeagueEmblemProps = {
  className?: string;
  compact?: boolean;
  emblem: LeagueEmblemView;
};

export function OfficialEmblemArtwork({
  className,
  emblem,
  priority = false
}: {
  className?: string;
  emblem: OfficialLeagueEmblem;
  priority?: boolean;
}) {
  const { crop } = emblem;
  const imageStyle = {
    height: "auto",
    left: `${(-crop.x / crop.width) * 100}%`,
    maxWidth: "none",
    top: `${(-crop.y / crop.height) * 100}%`,
    width: `${(SOURCE_WIDTH / crop.width) * 100}%`
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden
      className={cn("relative block shrink-0 overflow-hidden bg-black", className)}
      style={{ aspectRatio: `${crop.width} / ${crop.height}` }}
    >
      <Image
        alt=""
        className="absolute select-none"
        draggable={false}
        height={SOURCE_HEIGHT}
        priority={priority}
        src={EMBLEM_SPRITE}
        style={imageStyle}
        width={SOURCE_WIDTH}
      />
    </span>
  );
}

export function LeagueEmblem({ className, compact = false, emblem }: LeagueEmblemProps) {
  const definition = resolveLeagueEmblem(
    emblem.emblemKey,
    emblem.customTitle || emblem.badge.title,
    emblem.championship.name
  );
  const scopeLabel = emblem.isUniversal ? "Emblema universal" : emblem.championship.name;

  return (
    <span
      aria-label={`${definition.title}, ${scopeLabel}`}
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
      title={`${definition.title} - ${scopeLabel}`}
    >
      <OfficialEmblemArtwork
        className={cn("drop-shadow-[0_0_8px_rgba(244,180,26,0.28)]", compact ? "w-9" : "w-20")}
        emblem={definition}
      />
      {compact ? null : (
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight text-app-foreground">
            {definition.title}
          </span>
          <span className="mt-1 block text-xs text-app-muted">{scopeLabel}</span>
        </span>
      )}
    </span>
  );
}

export function LeagueEmblemList({ emblems }: { emblems: LeagueEmblemView[] }) {
  if (emblems.length === 0) {
    return null;
  }

  const uniqueEmblems = emblems.filter(
    (emblem, index, items) =>
      items.findIndex(
        (candidate) =>
          (candidate.emblemKey || candidate.badge.title) ===
          (emblem.emblemKey || emblem.badge.title)
      ) === index
  );

  return (
    <div aria-label="Insignias conquistadas" className="mt-2 flex flex-wrap items-center gap-2">
      {uniqueEmblems.slice(0, 4).map((emblem) => (
        <LeagueEmblem compact emblem={emblem} key={emblem.id} />
      ))}
      {uniqueEmblems.length > 4 ? (
        <span className="text-[11px] font-medium text-app-muted">+{uniqueEmblems.length - 4}</span>
      ) : null}
    </div>
  );
}
