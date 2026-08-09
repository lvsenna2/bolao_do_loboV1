const CANCELLED = "cancelled" as const;

export type PasskeyErrorContext = "login" | "registration";

/**
 * Converte a falha crua do navegador em uma mensagem acionavel. Retorna `cancelled`
 * quando a pessoa apenas fechou o prompt, para nao mostrar erro nesse caso.
 */
export function describePasskeyError(
  cause: unknown,
  context: PasskeyErrorContext,
  rpId?: string
): string | typeof CANCELLED {
  const name = cause instanceof Error ? cause.name : "";

  if (name === "NotAllowedError" || name === "AbortError") {
    return CANCELLED;
  }

  if (name === "InvalidStateError") {
    return context === "registration"
      ? "Este aparelho ja esta cadastrado para a sua conta."
      : "Biometria nao reconhecida neste aparelho.";
  }

  if (name === "SecurityError") {
    return rpId
      ? `Abra o site em ${rpId} para usar a biometria. Em outro endereco o aparelho bloqueia o cadastro.`
      : "O endereco usado para abrir o site nao permite biometria. Abra pelo site oficial.";
  }

  if (name === "NotSupportedError") {
    return "Este aparelho nao oferece biometria compativel. Use e-mail e senha.";
  }

  if (name === "ConstraintError") {
    return "Ative o bloqueio de tela (PIN, digital ou Face ID) no aparelho e tente de novo.";
  }

  return context === "registration"
    ? "Nao foi possivel cadastrar a biometria agora. Se abriu o site pelo WhatsApp ou Instagram, abra pelo Chrome ou Safari e tente de novo."
    : "Nao foi possivel entrar com biometria agora. Use e-mail e senha.";
}

/**
 * O aparelho so aceita a biometria quando o host atual e o proprio rpId ou um
 * subdominio dele. Detectar isso antes evita um SecurityError sem explicacao.
 */
export function isHostAllowedForRpId(hostname: string, rpId: string) {
  return hostname === rpId || hostname.endsWith(`.${rpId}`);
}

export function isCancelledPasskeyError(value: string | typeof CANCELLED): value is typeof CANCELLED {
  return value === CANCELLED;
}
