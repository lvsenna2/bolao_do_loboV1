# Assinaturas Mercado Pago

O modulo de assinaturas usa o mesmo provedor do Pix existente. O cartao e coletado somente no
checkout hospedado do Mercado Pago (`/preapproval`); o Bolao do Lobo nao recebe nem armazena
numero do cartao ou CVV.

## Variaveis de ambiente

```env
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET="..."
MERCADO_PAGO_NOTIFICATION_URL="https://seu-dominio/api/webhooks/mercado-pago"
MERCADO_PAGO_SUBSCRIPTION_BACK_URL="https://seu-dominio/planos"
NEXT_PUBLIC_APP_URL="https://seu-dominio"
```

## Webhook

Configure a URL `/api/webhooks/mercado-pago` na integracao Mercado Pago e habilite os eventos:

- Pagamentos (`payment`)
- Planos e assinaturas (`subscription_preapproval`)
- Pagamentos recorrentes (`subscription_authorized_payment`)

O endpoint valida `x-signature`, consulta o recurso diretamente no Mercado Pago e usa eventos com
chave unica para impedir processamento duplicado.

## Publicacao

Antes de publicar o codigo, aplique a migration aditiva:

```bash
pnpm prisma:deploy
```

A migration cria apenas as tabelas `subscriptions` e `subscription_events`, seus enums, indices e
relacionamentos. Ela nao exclui nem atualiza usuarios, pagamentos Pix ou dados existentes.

## Testes

Use credenciais de teste e usuarios de teste diferentes para vendedor e comprador. O Pix continua
usando `/v1/payments`; o cartao abre o `init_point` devolvido por `/preapproval`. Confirme no painel
e no webhook os cenarios aprovado, recusado, pendente, renovacao e cancelamento antes de trocar
para o Access Token de producao.
