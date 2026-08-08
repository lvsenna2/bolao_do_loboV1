import Image from "next/image";

import { getChampionshipLogoSrc } from "@/lib/championship-logo";
import { getTeamLogoSrc } from "@/lib/team-logo";
import { cn } from "@/lib/utils";

type LogoEntity = {
  apiId?: number | null;
  logo?: string | null;
  name: string;
};

type FootballLogoProps = LogoEntity & {
  className?: string;
  containerClassName?: string;
  kind: "championship" | "team";
  priority?: boolean;
  size?: number;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function FootballLogo({
  apiId,
  className,
  containerClassName,
  kind,
  logo,
  name,
  priority = false,
  size = 32
}: FootballLogoProps) {
  const src =
    kind === "team"
      ? getTeamLogoSrc({ apiId, logo })
      : getChampionshipLogoSrc({ apiId, logo });
  const canOptimize = Boolean(apiId);

  return (
    <span
      aria-label={name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-app-elevated text-xs font-bold text-app-foreground",
        containerClassName
      )}
      role="img"
      style={{ height: size, width: size }}
    >
      {src ? (
        canOptimize ? (
          <Image
            alt=""
            className={cn("object-contain", className)}
            fill
            priority={priority}
            quality={75}
            sizes={`${size}px`}
            src={src}
          />
        ) : (
          // Times cadastrados manualmente podem usar provedores fora da lista da API-Football.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className={cn("h-full w-full object-contain", className)}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            src={src}
          />
        )
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
