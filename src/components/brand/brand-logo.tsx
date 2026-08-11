import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  href?: string;
};

function BrandMark({ compact }: Pick<BrandLogoProps, "compact">) {
  return (
    <span
      className={cn(
        "brand-logo-mark relative inline-flex shrink-0 items-center justify-center",
        compact ? "h-9 w-9" : "h-11 w-11"
      )}
    >
      <Image
        alt={compact ? "Bolão do Lobo" : ""}
        className="h-full w-full object-contain"
        height={44}
        sizes={compact ? "36px" : "44px"}
        src="/brand/bolao-do-lobo-ui.webp"
        width={44}
      />
    </span>
  );
}

function BrandContent({ compact }: Pick<BrandLogoProps, "compact">) {
  return (
    <>
      <BrandMark compact={compact} />
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-app-foreground">Bolão do Lobo</span>
          <span className="block text-xs font-medium text-app-muted">Palpites esportivos</span>
        </span>
      ) : null}
    </>
  );
}

export function BrandLogo({ className, compact = false, href = "/" }: BrandLogoProps) {
  return (
    <Link
      className={cn("inline-flex items-center gap-3 rounded-button focus:outline-none", className)}
      href={href as Route}
    >
      <BrandContent compact={compact} />
    </Link>
  );
}
