# Rodadas Especiais

Modulo independente das ligas tradicionais. Ele nao cria `Guess`, `Score`, `Ranking`,
`LeagueMember` ou `Payment` de liga.

## Fluxo

1. O administrador cria um rascunho, configura prazos, premio e mercados.
2. A abertura das inscricoes notifica os usuarios.
3. Cada usuario possui uma unica `SpecialRoundEntry`.
4. Inscricoes pagas usam o mesmo cliente HTTP do Mercado Pago, mas sao conciliadas
   em `special_round_entries`.
5. Somente inscricoes aprovadas enviam palpites durante a janela validada no servidor.
6. Resultados oficiais sao gravados por mercado.
7. A apuracao usa o servico isolado em
   `src/features/special-rounds/services/scoring-service.ts`.
8. A publicacao libera ranking, palpites dos participantes e notificacoes.

## Seguranca

- Restricoes unicas impedem inscricao, palpite, resultado, pontuacao e premio duplicados.
- Acoes criticas usam transacoes serializaveis.
- Mudancas administrativas geram `SpecialRoundAuditLog`.
- O horario de fechamento e verificado no servidor.
- Palpites de terceiros ficam ocultos antes do fechamento ou inicio da partida.
- Recalculo e bloqueado depois que um premio e marcado como pago.

## Deploy

Aplicar a migration:

```bash
pnpm prisma:deploy
```

Variaveis ja usadas pela integracao de pagamento:

- `DATABASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_NOTIFICATION_URL` (opcional quando `NEXT_PUBLIC_APP_URL` esta correto)
- `NEXT_PUBLIC_APP_URL`

O webhook permanece em `/api/webhooks/mercado-pago` e identifica o tipo de pagamento
pelo `external_reference`.
