"use client";

import { cn } from "@/lib/utils";

type ActionAlertProps = {
  message?: string;
  tone?: "success" | "error";
};

export function ActionAlert({ message, tone = "error" }: ActionAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-control border px-3 py-2 text-sm",
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
      )}
      role="status"
    >
      {message}
    </div>
  );
}
