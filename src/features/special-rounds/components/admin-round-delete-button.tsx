"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { deleteSpecialRoundAction } from "../actions/special-round-actions";

export function AdminSpecialRoundDeleteButton({
  name,
  specialRoundId
}: {
  name: string;
  specialRoundId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !window.confirm(
        `Excluir definitivamente "${name}"? Mercados, resultados e configuracoes desta rodada tambem serao removidos.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteSpecialRoundAction(specialRoundId);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div>
      <LoadingButton
        className="inline-flex h-10 items-center rounded-button border border-red-500/50 px-4 text-sm font-semibold text-red-400 hover:bg-red-500/10"
        icon={<Trash2 className="h-4 w-4" />}
        isLoading={pending}
        loadingLabel="Excluindo..."
        onClick={remove}
      >
        Excluir
      </LoadingButton>
      {message && !pending ? (
        <p aria-live="polite" className="mt-2 text-xs text-red-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
