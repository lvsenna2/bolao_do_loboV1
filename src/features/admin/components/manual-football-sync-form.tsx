"use client";

import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import { FormLoadingButton } from "@/components/ui/loading-button";
import { runManualFootballSyncAction } from "@/features/admin/actions/admin-actions";
import type { AdminActionResult } from "@/features/admin/types";

type ManualFootballSyncFormProps = {
  disabled: boolean;
};

const initialState: AdminActionResult | null = null;

export function ManualFootballSyncForm({ disabled }: ManualFootballSyncFormProps) {
  const [state, formAction] = useActionState(runManualFootballSyncAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <FormLoadingButton
          className="h-11 rounded-button bg-brand-gold px-5 text-sm font-bold text-slate-950 shadow-soft hover:bg-amber-400"
          disabled={disabled}
          pendingLabel="Sincronizando..."
        >
          <RefreshCw aria-hidden className="h-4 w-4" />
          Sincronizar agora
        </FormLoadingButton>
      </form>

      {state ? (
        <div
          className={`mt-3 flex items-start gap-2 text-sm ${state.ok ? "text-emerald-300" : "text-amber-200"}`}
          role="status"
        >
          {state.ok ? (
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}
