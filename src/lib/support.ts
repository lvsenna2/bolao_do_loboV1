/**
 * Canal unico de atendimento. Fica em variavel de ambiente para trocar o endereco
 * sem novo deploy; o valor padrao e a caixa oficial do Bolao do Lobo.
 */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "suporte.bolaodolobo@gmail.com";

export function supportMailtoUrl(subject = "Suporte - Bolao do Lobo") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
