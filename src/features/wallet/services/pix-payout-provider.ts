import type { PixKeyType } from "@prisma/client";

/**
 * Porta do Pix de saida (envio de dinheiro para a chave de terceiro).
 *
 * IMPORTANTE — por que nao existe um provedor do Mercado Pago aqui:
 * a API publica do Mercado Pago (referencia em mercadopago.com.br/developers/pt/reference)
 * so tem entrada de dinheiro: Payments/Orders (inclusive Pix por QR Code), Preferences,
 * Subscriptions, Point/QR, Refunds, Chargebacks e Reports. Nao ha nenhum endpoint publico de
 * transferencia/payout para chave Pix de terceiro. "Payout" aparece apenas como linha do
 * relatorio de liberacoes, descrevendo um saque feito por fora — nao e uma chamada de API.
 *
 * Enviar Pix por API exige contrato com um PSP habilitado (Mercado Pago money out negociado
 * com o gerente da conta, Efi, Asaas, Celcoin, Inter, Stark Bank, Transfeera...), normalmente
 * com CNPJ, conta PJ e certificado mTLS. Quando esse contrato existir, basta implementar esta
 * interface e registrar o provedor abaixo — nada mais no fluxo de saque muda.
 *
 * Enquanto nenhum provedor estiver configurado, `getPixPayoutProvider()` devolve null e o
 * saque aprovado espera o Pix manual, exatamente como funciona hoje.
 */

export type PixPayoutRequest = {
  amountCents: number;
  /** Fixa por saque. O provedor precisa usar isso para nao transferir duas vezes. */
  idempotencyKey: string;
  pixKey: string;
  pixKeyOwnerName: string;
  pixKeyType: PixKeyType;
  withdrawalId: string;
};

export type PixPayoutResult =
  | { ok: true; providerStatus: string; transferId: string }
  | { ok: false; error: string; providerStatus?: string; transferId?: string };

export type PixPayoutProvider = {
  name: string;
  sendPix(request: PixPayoutRequest): Promise<PixPayoutResult>;
};

/**
 * Registro de provedores. Vazio de proposito: nenhum PSP de Pix de saida esta contratado.
 * Adicionar um provedor aqui e a unica mudanca necessaria para o botao Aprovar passar a
 * transferir sozinho.
 */
const providers: Record<string, () => PixPayoutProvider> = {};

export function getPixPayoutProviderName() {
  return process.env.PIX_PAYOUT_PROVIDER?.trim() || null;
}

export function getPixPayoutProvider(): PixPayoutProvider | null {
  const name = getPixPayoutProviderName();
  if (!name || name === "none" || name === "manual") return null;

  const factory = providers[name];
  if (!factory) {
    console.error("[wallet] PIX_PAYOUT_PROVIDER desconhecido; saque segue com Pix manual", {
      configured: name,
      known: Object.keys(providers)
    });
    return null;
  }

  return factory();
}

export function isAutomaticPixPayoutEnabled() {
  return getPixPayoutProvider() !== null;
}
