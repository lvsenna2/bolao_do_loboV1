"use client";

import { Minus, Plus } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";

type ScoreInputProps = {
  ariaLabel: string;
  invalid?: boolean;
  onChange: (value: number) => void;
  value: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(99, value));
}

export const ScoreInput = memo(function ScoreInput({
  ariaLabel,
  invalid = false,
  onChange,
  value
}: ScoreInputProps) {
  const filled = Number.isFinite(value);
  const score = filled ? value : 0;

  return (
    <div
      className={cn(
        "grid h-10 shrink-0 grid-cols-[40px_48px_40px] overflow-hidden rounded-control border bg-app-background",
        invalid ? "border-brand-red" : "border-app-border"
      )}
    >
      <button
        aria-label={`Diminuir ${ariaLabel}`}
        className="inline-flex items-center justify-center border-r border-app-border text-app-muted active:bg-app-elevated disabled:opacity-40"
        disabled={filled && score <= 0}
        onClick={() => onChange(clampScore(filled ? score - 1 : 0))}
        type="button"
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        aria-label={ariaLabel}
        className="min-w-0 appearance-none bg-transparent text-center text-base font-bold tabular-nums text-app-foreground outline-none focus:bg-brand-gold/10"
        data-score-input
        inputMode="numeric"
        max={99}
        min={0}
        onChange={(event) => {
          const nextValue = event.target.valueAsNumber;
          onChange(Number.isFinite(nextValue) ? clampScore(nextValue) : Number.NaN);
        }}
        onFocus={(event) => event.currentTarget.select()}
        placeholder="–"
        type="number"
        value={filled ? score : ""}
      />
      <button
        aria-label={`Aumentar ${ariaLabel}`}
        className="inline-flex items-center justify-center border-l border-app-border text-app-muted active:bg-app-elevated disabled:opacity-40"
        disabled={filled && score >= 99}
        onClick={() => onChange(clampScore(filled ? score + 1 : 1))}
        type="button"
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
});
