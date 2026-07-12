"use client";

import { FormLoadingButton } from "@/components/ui/loading-button";

type AdminDeleteButtonProps = {
  confirmMessage: string;
  label?: string;
};

export function AdminDeleteButton({ confirmMessage, label = "Excluir" }: AdminDeleteButtonProps) {
  return (
    <FormLoadingButton
      className="h-10 rounded-button bg-brand-red px-3 text-sm font-semibold text-white transition hover:bg-red-700"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      pendingLabel="Processando..."
      type="submit"
    >
      {label}
    </FormLoadingButton>
  );
}
