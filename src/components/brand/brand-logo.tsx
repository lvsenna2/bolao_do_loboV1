import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  /** `true` esconde o nome sempre; `"mobile"` esconde so abaixo de 640px. */
  compact?: boolean | "mobile";
  href?: string;
};

function BrandMark({ compact }: Pick<BrandLogoProps, "compact">) {
  return (
    <span
      className={cn(
        "brand-logo-mark relative inline-flex shrink-0 items-center justify-center",
        compact === true ? "h-9 w-9" : "",
        compact === "mobile" ? "h-9 w-9 sm:h-11 sm:w-11" : "",
        compact === false ? "h-11 w-11" : ""
      )}
    >
      <Image
        alt="Bolão do Lobo"
        className="h-full w-full object-contain"
        height={44}
        sizes={compact === false ? "44px" : "36px"}
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
      {compact === true ? null : (
        <span className={cn("leading-tight", compact === "mobile" ? "hidden sm:block" : "")}>
          <span className="block text-sm font-semibold text-app-foreground">Bolão do Lobo</span>
          <span className="block text-xs font-medium text-app-muted">Palpites esportivos</span>
        </span>
      )}
    </>
  );
}

export function BrandLogo({ className, compact = false, href = "/" }: BrandLogoProps) {
  return (
    <Link
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-button focus:outline-none sm:gap-3",
        className
      )}
      href={href as Route}
    >
      <BrandContent compact={compact} />
    </Link>
  );
}
