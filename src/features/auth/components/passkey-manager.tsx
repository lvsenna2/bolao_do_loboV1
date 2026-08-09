"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import {
  finishPasskeyRegistrationAction,
  removePasskeyAction,
  startPasskeyRegistrationAction
} from "../actions/passkey-actions";
import {
  describePasskeyError,
  isCancelledPasskeyError,
  isHostAllowedForRpId
} from "../utils/passkey-errors";
import { ActionAlert } from "./action-alert";

export type PasskeySummary = {
  createdAt: string;
  id: string;
  label: string;
  lastUsedAt: string | null;
};

type PasskeyManagerProps = {
  passkeys: PasskeySummary[];
};

function suggestDeviceLabel() {
  if (typeof navigator === "undefined") return "Meu aparelho";
  const agent = navigator.userAgent;
  if (/iPhone|iPad/i.test(agent)) return "iPhone/iPad";
  if (/Android/i.test(agent)) return "Android";
  if (/Windows/i.test(agent)) return "PC Windows";
  if (/Macintosh/i.test(agent)) return "Mac";
  return "Meu aparelho";
}

export function PasskeyManager({ passkeys }: PasskeyManagerProps) {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
  }, []);

  async function onRegister() {
    setIsRegistering(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const started = await startPasskeyRegistrationAction();

      if (!started.ok || !started.data) {
        setError(started.message);
        return;
      }

      const options = started.data.options as { rp?: { id?: string } };
      const rpId = options.rp?.id;

      if (rpId && !isHostAllowedForRpId(window.location.hostname, rpId)) {
        setError(
          `Abra o site em ${rpId} para cadastrar a biometria. Neste endereco o aparelho bloqueia o cadastro.`
        );
        return;
      }

      const response = await startRegistration({
        optionsJSON: started.data.options as never
      });
      const finished = await finishPasskeyRegistrationAction({
        challengeId: started.data.challengeId,
        label: suggestDeviceLabel(),
        response: JSON.stringify(response)
      });

      if (!finished.ok) {
        setError(finished.message);
        return;
      }

      setMessage(
        "Biometria ativada neste aparelho. No proximo login, toque em Entrar com Face ID / digital."
      );
      router.refresh();
    } catch (cause) {
      console.error("[passkey] Falha no cadastro", cause);
      const described = describePasskeyError(cause, "registration", window.location.hostname);
      if (!isCancelledPasskeyError(described)) {
        setError(described);
      }
    } finally {
      setIsRegistering(false);
    }
  }

  async function onRemove(id: string) {
    setRemovingId(id);
    setError(undefined);
    setMessage(undefined);

    try {
      const result = await removePasskeyAction(id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    } finally {
      setRemovingId(undefined);
    }
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return (
    <div className="space-y-4">
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      {passkeys.length > 0 ? (
        <ul className="space-y-2">
          {passkeys.map((passkey) => (
            <li
              className="flex items-center justify-between gap-3 rounded-button border border-white/10 px-3 py-2"
              key={passkey.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-app-foreground">
                  {passkey.label}
                </p>
                <p className="text-xs text-app-muted">
                  Cadastrada em {formatter.format(new Date(passkey.createdAt))}
                  {passkey.lastUsedAt
                    ? ` | Ultimo uso em ${formatter.format(new Date(passkey.lastUsedAt))}`
                    : ""}
                </p>
              </div>
              <LoadingButton
                className="inline-flex h-9 items-center justify-center gap-1 rounded-button border border-red-500/40 px-3 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={removingId === passkey.id}
                icon={<Trash2 aria-hidden className="h-3.5 w-3.5" />}
                isLoading={removingId === passkey.id}
                loadingLabel="Removendo..."
                onClick={() => onRemove(passkey.id)}
                type="button"
              >
                Remover
              </LoadingButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-app-muted">
          Nenhum aparelho cadastrado ainda. Ative para entrar sem digitar a senha.
        </p>
      )}
      {isSupported ? (
        <LoadingButton
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isRegistering}
          icon={<Fingerprint aria-hidden className="h-4 w-4" />}
          isLoading={isRegistering}
          loadingLabel="Aguardando o aparelho..."
          onClick={onRegister}
          type="button"
        >
          Ativar biometria neste aparelho
        </LoadingButton>
      ) : (
        <p className="text-sm text-app-muted">
          Este navegador nao suporta login por biometria (passkeys).
        </p>
      )}
    </div>
  );
}
