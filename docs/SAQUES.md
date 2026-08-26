# Saques (Pix de saida)

## Por que o Pix ainda nao sai sozinho

Verificado em 14/ago/2026 na documentacao oficial: **a API publica do Mercado Pago nao tem
endpoint de Pix de saida**. A referencia
(`mercadopago.com.br/developers/pt/reference`) so lista entrada de dinheiro — Payments/Orders
(inclusive Pix por QR Code), Preferences, Subscriptions, Point/QR, Refunds, Chargebacks,
Claims, Reports e OAuth. "Payout" aparece apenas como **linha do relatorio de liberacoes**,
descrevendo um saque que saiu da conta; nao e uma chamada de API.

Enviar Pix por API exige contrato com um PSP habilitado:

- **Mercado Pago money out** — negociado com o gerente da conta, fora da API publica.
- **PSP com API de Pix out** — Efi, Asaas, Celcoin, Inter, Stark Bank, Transfeera, BTG, Itau.
  Praticamente todos exigem CNPJ, conta PJ e certificado mTLS.

Por isso o codigo **nao** tem um provedor do Mercado Pago: inventar um endpoint que nao existe
so quebraria em producao.

## O que ja esta pronto para quando o contrato existir

O fluxo de aprovacao ja e automatico ponta a ponta — falta so o adaptador do PSP.
`src/features/wallet/services/pix-payout-provider.ts` define a porta:

```ts
export type PixPayoutProvider = {
  name: string;
  sendPix(request: PixPayoutRequest): Promise<PixPayoutResult>;
};
```

Para ligar a automacao: implementar essa interface, registrar no mapa `providers` e apontar a
env `PIX_PAYOUT_PROVIDER` para o nome escolhido. **Nada mais muda** — botao, telas, status,
notificacoes e auditoria ja tratam o caminho automatico. Sem env (ou com `none`/`manual`), o
saque aprovado espera o Pix manual, exatamente como sempre funcionou.

O Access Token e qualquer credencial do PSP ficam **so no backend**: a porta e chamada dentro
de server actions, e nenhum campo sensivel chega ao componente cliente.

## Como funciona hoje

1. O usuario pede o saque em `/carteira` informando valor, tipo da chave, chave e nome do dono.
2. O saldo **sai da carteira na hora** (`WalletTransaction` tipo `WITHDRAWAL`). Isso evita que o
   mesmo dinheiro seja gasto em palpite enquanto o pedido espera. O pedido ja nasce com uma
   `payoutIdempotencyKey` unica.
3. So existe **um saque aberto por usuario** (`REQUESTED`, `APPROVED`, `PIX_PROCESSING` ou
   `PIX_FAILED`).
4. Em `/admin/saques` o admin:
   - **Aprova** (`REQUESTED` -> `APPROVED`) depois de conferir que a chave e do proprio usuario.
     Com provedor configurado, a aprovacao ja dispara o Pix (ver abaixo);
   - sem provedor, faz o Pix pelo banco e **marca como pago** (`APPROVED` -> `PAID`);
   - ou **recusa** com motivo — o valor volta para a carteira como `REFUND`.
5. O usuario pode **cancelar** enquanto estiver em `REQUESTED`; depois de aprovado, so o admin desfaz.

Cada transicao grava `AuditLog` e dispara notificacao para o usuario.

## Status

| Status | Significado |
| --- | --- |
| `REQUESTED` | aguardando aprovacao do admin (o "PENDING_APPROVAL" do pedido) |
| `APPROVED` | aprovado; sem provedor, esperando o Pix manual |
| `PIX_PROCESSING` | Pix enviado ao provedor, aguardando resposta |
| `PAID` | Pix confirmado |
| `PIX_FAILED` | o provedor recusou ou deu erro; **valor segue retido**, nunca marcado como pago |
| `REJECTED` | recusado pelo admin, valor devolvido |
| `CANCELLED` | cancelado pelo usuario, valor devolvido |

`PIX_FAILED` aparece no painel como **Falha no Pix** com a mensagem do erro e um botao
**Reenviar Pix**. O admin tambem pode fechar o saque manualmente com o comprovante do banco.

## Protecao contra Pix duplicado

Duas camadas:

1. **Transicao com filtro de status** — `updateMany ... where { id, status: <anterior> }`. Dois
   cliques simultaneos em Aprovar: so um encontra a linha, o outro recebe
   `WITHDRAWAL_NOT_REVIEWABLE`/`WITHDRAWAL_PIX_ALREADY_RUNNING` e para antes de chamar o PSP.
2. **Idempotencia no provedor** — a `payoutIdempotencyKey` nasce com o pedido e nunca muda,
   inclusive nas retentativas. Se o Pix ja saiu, o PSP reconhece a chave e nao transfere de novo.

Recusar um saque em `PIX_PROCESSING` e **proibido**: enquanto o provedor nao responde nao da
para saber se o dinheiro saiu, e devolver o saldo ali arriscaria pagar duas vezes.

## O que fica registrado

`wallet_withdrawals` guarda id, usuario, valor, chave Pix e dono, data do pedido
(`created_at`), data da aprovacao (`approved_at`), **quem aprovou** (`approved_by_id`, separado
de `reviewed_by_id` para nao ser sobrescrito), provedor (`transfer_provider`), id da
transferencia (`transfer_id`, unico), status no provedor (`transfer_status`) e mensagem de erro
(`transfer_error`).

## Limites

| Regra | Valor | Onde mudar |
| --- | --- | --- |
| Saque minimo | R$ 20,00 | `MIN_WITHDRAWAL_CENTS` |
| Saque maximo por pedido | R$ 5.000,00 | `MAX_WITHDRAWAL_CENTS` |
| Saques abertos por usuario | 1 | `OPEN_STATUSES` |

Arquivo: `src/features/wallet/services/withdrawal-service.ts`.

## Migrations

- `20260813000100_wallet_withdrawals` — tabela `wallet_withdrawals`.
- `20260814000200_withdrawal_pix_payout` — status `PIX_PROCESSING`/`PIX_FAILED`, aprovador,
  rastreio da transferencia e `payout_idempotency_key` (saques antigos herdam o proprio id).

O Build Command da Vercel roda apenas `pnpm build` e nao depende de acesso ao banco.
As migrations devem ser aplicadas manualmente, uma unica vez, fora do build:

```bash
pnpm prisma migrate deploy
```

## Pontos em aberto

- **Prevencao de lavagem**: hoje da para depositar via Pix e sacar em seguida. Se isso virar
  problema, o caminho e exigir que o valor sacado tenha origem em premio/roleta, ou segurar o
  deposito por N dias antes de liberar para saque.
- **Conferencia do dono da chave**: e visual, feita pelo admin. Com API de Pix out da para validar
  o CPF do titular da chave automaticamente.
- **Imposto/relatorio**: os saques pagos ficam em `wallet_withdrawals` com `paid_at` e
  `receipt_ref`, prontos para alimentar a planilha de financas.
