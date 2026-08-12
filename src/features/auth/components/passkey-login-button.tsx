"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { getPostLoginDestinationFromAuthResult } from "../utils/login-destination";
import { describePasskeyError, isCancelledPasskeyError } from "../utils/passkey-errors";
import { ActionAlert } from "./action-alert";

type PasskeyLoginButtonProps = {
  callbackUrl?: string;
};

export function PasskeyLoginButton({ callbackUrl }: PasskeyLoginButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hint, setHint] = useState<string | undefined>();

  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
  }, []);

  if (!isSupported) {
    return null;
  }

  async function onPasskeyLogin() {
    setIsAuthenticating(true);
    setError(undefined);
    setHint(undefined);

    try {
      const optionsResponse = await fetch("/api/auth/passkey/options", { method: "POST" });
      const optionsPayload = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsPayload.ok) {
        setError("Nao foi possivel iniciar o login por biometria.");
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: optionsPayload.options });
      const result = await signIn("passkey", {
        assertion: JSON.stringify(assertion),
        challengeId: optionsPayload.challengeId,
        redirect: false
      });

      if (!result || result.error) {
        setError("Biometria nao reconhecida. Entre com e-mail e senha e cadastre novamente.");
        return;
      }

      const session = await getSession();
      const destination = getPostLoginDestinationFromAuthResult(
        callbackUrl,
        session?.user?.role,
        result?.url
      );
      window.location.assign(destination);
    } catch (cause) {
      console.error("[passkey] Falha no login", cause);
      const described = describePasskeyError(cause, "login", window.location.hostname);
      // NotAllowedError cobre tanto "fechei o prompt" quanto "nao existe passkey neste
      // aparelho" — o navegador nao diferencia. A dica cobre o segundo caso sem assustar.
      if (isCancelledPasskeyError(described)) {
        setHint(
          "Se nenhum pedido de biometria apareceu, entre com e-mail e senha e cadastre a biometria em Perfil, neste mesmo aparelho."
        );
      } else {
        setError(described);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-app-muted">ou</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <ActionAlert message={error} />
      <LoadingButton
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button border border-brand-gold/40 bg-transparent px-4 text-sm font-semibold text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isAuthenticating}
        icon={<Fingerprint aria-hidden className="h-4 w-4" />}
        isLoading={isAuthenticating}
        loadingLabel="Confirmando biometria..."
        onClick={onPasskeyLogin}
        type="button"
      >
        Entrar com Face ID / digital
      </LoadingButton>
      {hint ? (
        <p className="rounded-control border border-app-border bg-app-elevated px-3 py-2 text-xs text-app-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
