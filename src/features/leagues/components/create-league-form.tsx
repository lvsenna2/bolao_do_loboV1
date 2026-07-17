"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LeagueVisibility } from "@prisma/client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { AuthField } from "@/features/auth/components/auth-field";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { cn } from "@/lib/utils";
import { createAdminLeagueAction, createLeagueAction } from "../actions/league-actions";
import {
  createAdminLeagueSchema,
  type CreateAdminLeagueInput,
  type CreateLeagueInput
} from "../schemas/league-schemas";

type CreateLeagueFormProps = {
  admin?: boolean;
  championships: Array<{
    country: string;
    id: string;
    label: string;
    logo: string | null;
  }>;
};

const fieldClass =
  "h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

const visibilityLabels = {
  INVITE_ONLY: "Somente convite",
  PRIVATE: "Privada por codigo",
  PUBLIC: "Publica"
} satisfies Record<LeagueVisibility, string>;

export function CreateLeagueForm({ admin = false, championships }: CreateLeagueFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError
  } = useForm<CreateAdminLeagueInput>({
    resolver: zodResolver(createAdminLeagueSchema),
    defaultValues: {
      championshipId: championships[0]?.id ?? "",
      description: "",
      entryFee: 0,
      imageUrl: "",
      maxMembers: undefined,
      name: "",
      ownerEmail: "",
      visibility: admin ? "PUBLIC" : "PRIVATE"
    }
  });

  function onSubmit(values: CreateAdminLeagueInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      const action = admin
        ? createAdminLeagueAction(values)
        : createLeagueAction(toCreateLeagueInput(values));

      void action.then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        setMessage(result.message);
        reset({
          championshipId: championships[0]?.id ?? "",
          description: "",
          entryFee: 0,
          imageUrl: "",
          maxMembers: undefined,
          name: "",
          ownerEmail: "",
          visibility: admin ? "PUBLIC" : "PRIVATE"
        });
        router.refresh();
      });
    });
  }

  return (
    <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="lg:col-span-4">
        <ActionAlert message={message} tone="success" />
        <ActionAlert message={error} />
      </div>

      {admin ? (
        <AuthField
          error={errors.ownerEmail?.message}
          id="ownerEmail"
          label="E-mail do dono"
          placeholder="Vazio usa seu admin"
          type="email"
          {...register("ownerEmail")}
        />
      ) : null}

      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Campeonato</span>
        <select className={fieldClass} {...register("championshipId")}>
          <option value="">Selecione</option>
          {championships.map((championship) => (
            <option key={championship.id} value={championship.id}>
              {championship.label} - {championship.country}
            </option>
          ))}
        </select>
        {errors.championshipId?.message ? (
          <p className="text-sm text-red-600 dark:text-red-300">{errors.championshipId.message}</p>
        ) : null}
      </label>

      <AuthField
        error={errors.name?.message}
        id={admin ? "adminLeagueName" : "leagueName"}
        label="Nome da liga"
        placeholder="Ex: Bolao dos Lobos"
        {...register("name")}
      />

      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Visibilidade</span>
        <select className={fieldClass} {...register("visibility")}>
          {Object.values(LeagueVisibility).map((visibility) => (
            <option key={visibility} value={visibility}>
              {visibilityLabels[visibility]}
            </option>
          ))}
        </select>
        {errors.visibility?.message ? (
          <p className="text-sm text-red-600 dark:text-red-300">{errors.visibility.message}</p>
        ) : null}
      </label>

      <AuthField
        error={errors.entryFee?.message}
        id={admin ? "adminEntryFee" : "entryFee"}
        label="Valor de entrada"
        min="0"
        placeholder="0"
        step="0.01"
        type="number"
        {...register("entryFee")}
      />

      <AuthField
        error={errors.maxMembers?.message}
        id={admin ? "adminMaxMembers" : "maxMembers"}
        label="Limite de participantes"
        min="2"
        placeholder="Sem limite"
        type="number"
        {...register("maxMembers")}
      />

      <AuthField
        error={errors.startsAt?.message}
        id={admin ? "adminStartsAt" : "startsAt"}
        label="Inicio"
        type="datetime-local"
        {...register("startsAt")}
      />

      <AuthField
        error={errors.endsAt?.message}
        id={admin ? "adminEndsAt" : "endsAt"}
        label="Fim"
        type="datetime-local"
        {...register("endsAt")}
      />

      <AuthField
        error={errors.imageUrl?.message}
        id={admin ? "adminImageUrl" : "imageUrl"}
        label="Imagem da liga"
        placeholder="https://..."
        type="url"
        {...register("imageUrl")}
      />

      <label className="space-y-2 lg:col-span-3">
        <span className="text-sm font-medium text-app-foreground">Descricao</span>
        <textarea
          className={cn(fieldClass, "min-h-24 py-3")}
          placeholder="Regras ou descricao curta da liga"
          {...register("description")}
        />
        {errors.description?.message ? (
          <p className="text-sm text-red-600 dark:text-red-300">{errors.description.message}</p>
        ) : null}
      </label>

      <div className="flex items-end">
        <LoadingButton
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending || championships.length === 0}
          icon={<Plus aria-hidden className="h-4 w-4" />}
          isLoading={isPending}
          loadingLabel="Salvando..."
          type="submit"
        >
          Criar liga
        </LoadingButton>
      </div>
    </form>
  );
}

function toCreateLeagueInput(values: CreateAdminLeagueInput): CreateLeagueInput {
  return {
    championshipId: values.championshipId,
    description: values.description,
    endsAt: values.endsAt,
    entryFee: values.entryFee,
    imageUrl: values.imageUrl,
    maxMembers: values.maxMembers,
    name: values.name,
    startsAt: values.startsAt,
    visibility: values.visibility
  };
}
