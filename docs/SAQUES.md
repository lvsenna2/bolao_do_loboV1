# Saques (Pix de saida)

## Por que o fluxo e manual

O Mercado Pago nao libera transferencia Pix por API para conta comum. Enviar dinheiro
automaticamente exige um dos caminhos abaixo, todos com contrato e analise:

- **Mercado Pago** — habilitar a API de Pagamentos/Transferencias com o gerente da conta.
- **Banco/PSP com API de Pix out** — Efi (ex-Gerencianet), Asaas, Celcoin, Inter, Banco do Brasil.
  Exigem CNPJ, conta PJ e certificado mTLS.

Ate isso existir, o saque roda com **conferencia manual**: o app registra o pedido e retem o
saldo; o Pix e feito por fora, pelo app do banco, e o admin marca como pago.

## Como funciona hoje

1. O usuario pede o saque em `/carteira` informando valor, tipo da chave, chave e nome do dono.
2. O saldo **sai da carteira na hora** (`WalletTransaction` tipo `WITHDRAWAL`). Isso evita que o
   mesmo dinheiro seja gasto em palpite enquanto o pedido espera.
3. So existe **um saque aberto por usuario** (`REQUESTED` ou `APPROVED`).
4. Em `/admin/saques` o admin:
   - **Aprova** (`REQUESTED` -> `APPROVED`) depois de conferir que a chave e do proprio usuario;
   - faz o Pix pelo banco e **marca como pago** (`APPROVED` -> `PAID`), anotando o comprovante;
   - ou **recusa** com motivo — o valor volta para a carteira como `REFUND`.
5. O usuario pode **cancelar** enquanto estiver em `REQUESTED`; depois de aprovado, so o admin desfaz.

Cada transicao grava `AuditLog` e dispara notificacao para o usuario.

## Limites

| Regra | Valor | Onde mudar |
| --- | --- | --- |
| Saque minimo | R$ 20,00 | `MIN_WITHDRAWAL_CENTS` |
| Saque maximo por pedido | R$ 5.000,00 | `MAX_WITHDRAWAL_CENTS` |
| Saques abertos por usuario | 1 | `OPEN_STATUSES` |

Arquivo: `src/features/wallet/services/withdrawal-service.ts`.

## Migration

A tabela `wallet_withdrawals` entra pela migration `20260813000100_wallet_withdrawals`. O Build
Command da Vercel esta sobrescrito com `pnpm build`, que **nao roda migrations** — aplique a parte:

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
