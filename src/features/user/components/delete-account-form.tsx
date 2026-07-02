"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { ActionAlert } from "@/features/auth/components/action-alert";
import { AuthField } from "@/features/auth/components/auth-field";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { deleteOwnAccountAction } from "../actions/user-actions";
import { deleteAccountSchema, type DeleteAccountInput } from "../schemas/user-schemas";

export function DeleteAccountForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      confirm: "" as DeleteAccountInput["confirm"]
    }
  });

  function onSubmit(values: DeleteAccountInput) {
    setErrorMessage(undefined);

    startTransition(() => {
      void deleteOwnAccountAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        void signOut({ callbackUrl: "/login" });
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <ActionAlert message={error} />
      <AuthField
        error={errors.confirm?.message}
        id="confirm"
        label="Digite EXCLUIR para confirmar"
        {...register("confirm")}
      />
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-red px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        Excluir conta
        {!isPending ? <Trash2 aria-hidden className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}
