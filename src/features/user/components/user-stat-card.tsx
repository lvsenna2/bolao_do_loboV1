import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UserStatCardProps = {
  compact?: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
};

export function UserStatCard({
  compact = false,
  description,
  icon: Icon,
  label,
  value
}: UserStatCardProps) {
  return (
    <Card className="min-w-0">
      <CardContent
        className={cn(
          "flex items-start gap-4 p-5",
          compact && "h-full flex-col gap-2 p-3 sm:flex-row sm:gap-4 sm:p-5"
        )}
      >
        <span
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-brand-gold/15 text-brand-gold",
            compact && "h-8 w-8 sm:h-11 sm:w-11"
          )}
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium text-app-muted", compact && "text-xs sm:text-sm")}>
            {label}
          </p>
          <p className="mt-1 break-all text-2xl font-bold tabular-nums text-app-foreground">
            {value}
          </p>
          <p
            className={cn(
              "mt-1 text-xs text-app-muted",
              compact && "sr-only sm:not-sr-only sm:mt-1"
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
