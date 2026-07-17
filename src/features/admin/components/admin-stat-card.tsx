import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type AdminStatCardProps = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: string | number;
};

export function AdminStatCard({ description, icon: Icon, label, value }: AdminStatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button bg-brand-gold/10 text-brand-gold">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-app-foreground">{value}</p>
          <p className="mt-1 text-xs text-app-muted">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
