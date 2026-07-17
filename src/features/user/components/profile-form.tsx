"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Save, Trash2 } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Avatar } from "@/components/ui/avatar";
import { LoadingButton } from "@/components/ui/loading-button";
import { AuthField } from "@/features/auth/components/auth-field";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { updateProfileAction } from "../actions/user-actions";
import { updateProfileSchema, type UpdateProfileInput } from "../schemas/user-schemas";

type ProfileFormProps = {
  defaultValues: UpdateProfileInput;
};

const avatarAcceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxOriginalAvatarSize = 6 * 1024 * 1024;
const avatarOutputSize = 512;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
    image.src = src;
  });
}

async function createAvatarDataUrl(file: File) {
  if (!avatarAcceptedTypes.has(file.type)) {
    throw new Error("Envie uma imagem em JPG, PNG ou WebP.");
  }

  if (file.size > maxOriginalAvatarSize) {
    throw new Error("Envie uma imagem de ate 6 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    const size = Math.min(image.width, image.height);
    const sourceX = Math.max(0, (image.width - size) / 2);
    const sourceY = Math.max(0, (image.height - size) / 2);

    canvas.width = avatarOutputSize;
    canvas.height = avatarOutputSize;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Nao foi possivel processar a imagem.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, avatarOutputSize, avatarOutputSize);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      avatarOutputSize,
      avatarOutputSize
    );

    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
    watch
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues
  });
  const avatarPreview = watch("avatarUrl");

  async function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setMessage(undefined);
    setErrorMessage(undefined);

    try {
      const avatarDataUrl = await createAvatarDataUrl(file);
      setValue("avatarUrl", avatarDataUrl, {
        shouldDirty: true,
        shouldValidate: true
      });
      clearErrors("avatarUrl");
    } catch (avatarError) {
      setError("avatarUrl", {
        message:
          avatarError instanceof Error ? avatarError.message : "Nao foi possivel usar esta foto."
      });
    }
  }

  function removeAvatar() {
    setValue("avatarUrl", "", {
      shouldDirty: true,
      shouldValidate: true
    });
    clearErrors("avatarUrl");
  }

  function onSubmit(values: UpdateProfileInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void updateProfileAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        setMessage(result.message);
      });
    });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="md:col-span-2">
        <ActionAlert message={message} tone="success" />
        <ActionAlert message={error} />
      </div>
      <AuthField
        error={errors.firstName?.message}
        id="firstName"
        label="Nome"
        {...register("firstName")}
      />
      <AuthField
        error={errors.lastName?.message}
        id="lastName"
        label="Sobrenome"
        {...register("lastName")}
      />
      <AuthField
        error={errors.username?.message}
        id="username"
        label="Username"
        {...register("username")}
      />
      <div className="space-y-3 md:col-span-2">
        <span className="text-sm font-medium text-app-foreground">Foto de perfil</span>
        <div className="flex flex-col gap-4 rounded-control border border-app-border bg-app-background p-4 sm:flex-row sm:items-center">
          <Avatar
            className="h-20 w-20 text-xl"
            name={defaultValues.firstName}
            src={avatarPreview}
          />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                <Camera aria-hidden className="h-4 w-4" />
                Escolher foto
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onAvatarFileChange}
                  type="file"
                />
              </label>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                onClick={removeAvatar}
                type="button"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Remover
              </button>
            </div>
            <AuthField
              error={errors.avatarUrl?.message}
              id="avatarUrl"
              label="Ou cole uma URL da foto"
              placeholder="https://..."
              {...register("avatarUrl")}
            />
            <p className="text-xs leading-5 text-app-muted">
              A imagem enviada e ajustada automaticamente para ficar leve e quadrada.
            </p>
          </div>
        </div>
      </div>
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Idioma</span>
        <select
          className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          {...register("locale")}
        >
          <option value="pt-BR">pt-BR</option>
          <option value="en-US">en-US</option>
          <option value="es-ES">es-ES</option>
        </select>
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Tema</span>
        <select
          className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          {...register("theme")}
        >
          <option value="system">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
        </select>
      </label>
      <div className="md:col-span-2">
        <LoadingButton
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          icon={<Save aria-hidden className="h-4 w-4" />}
          isLoading={isPending}
          loadingLabel="Salvando..."
          type="submit"
        >
          Salvar perfil
        </LoadingButton>
      </div>
    </form>
  );
}
