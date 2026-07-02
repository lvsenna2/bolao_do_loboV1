import { PawPrint } from "lucide-react";
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
        "wolf-brand-mark inline-flex items-center justify-center rounded-button bg-brand-gold text-slate-950 shadow-sm",
        compact ? "h-9 w-9" : "h-10 w-10"
      )}
    >
      <PawPrint aria-hidden className={compact ? "h-5 w-5" : "h-6 w-6"} />
    </span>
  );
}

function BrandContent({ compact }: Pick<BrandLogoProps, "compact">) {
  return (
    <>
      <BrandMark compact={compact} />
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-sm font-bold text-app-foreground">Bolao do Lobo</span>
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
