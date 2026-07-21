# Deploy de Homologacao

Este projeto precisa de um ambiente com Next.js e PostgreSQL. Para testes com usuarios, use uma URL publica e um banco em nuvem separado do banco local.

## Caminho recomendado

1. Crie um PostgreSQL em nuvem.
   - Pode ser Neon, Supabase, Railway, Render ou outro provedor PostgreSQL.
   - Copie a connection string e use como `DATABASE_URL`.

2. Publique o repositorio em um Git remoto.

3. Crie o app web no provedor de hospedagem.
   - Framework: Next.js
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Start command, se solicitado: `pnpm start`

4. Configure as variaveis de ambiente:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://sua-url-publica"
NEXT_PUBLIC_APP_URL="https://sua-url-publica"
NEXTAUTH_SECRET="gere-um-segredo-forte"

MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_WEBHOOK_SECRET=""
MERCADO_PAGO_NOTIFICATION_URL="https://sua-url-publica/api/webhooks/mercado-pago"
API_FOOTBALL_KEY=""
API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
FOOTBALL_SYNC_CACHE_HOURS="12"
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

Para o PIX dinamico, use as credenciais de producao da sua aplicacao Mercado Pago. Em
`Suas integracoes > Webhooks`, configure o evento de pagamentos para a mesma URL informada em
`MERCADO_PAGO_NOTIFICATION_URL` e copie a assinatura secreta para
`MERCADO_PAGO_WEBHOOK_SECRET`. Nunca use o Access Token em variaveis `NEXT_PUBLIC_*`.

Para gerar `NEXTAUTH_SECRET` localmente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

5. Aplique migrations no banco remoto, se precisar rodar manualmente:

```bash
pnpm prisma:deploy
```

Evite rodar migration dentro do build da Vercel. Se aparecer erro de lock/advisory lock,
aguarde alguns minutos, cancele deploys antigos em andamento e rode a migration uma unica vez
fora do build.

6. Cadastre campeonatos, ligas, rodadas e partidas pelo painel administrativo ou sincronize as competicoes reais configuradas no admin.

## Zerar banco e manter somente o admin

Use este caminho quando quiser limpar o banco publicado e remover campeonatos, ligas, rodadas, partidas,
palpites, rankings, usuarios comuns e dados auxiliares, mantendo apenas o login do admin.

Configure no ambiente que vai executar o comando:

```env
DATABASE_URL="postgresql://..."
ALLOW_DB_RESET="true"
SEED_ADMIN_NAME="Administrador"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_EMAIL="admin@bolaodolobo.local"
SEED_ADMIN_PASSWORD="defina-uma-senha-segura"
```

Depois rode:

```bash
pnpm db:reset-admin-only
```

Remova `ALLOW_DB_RESET` ou volte para `false` depois da limpeza.

## Limpeza de dados demo antigos

Se o banco ainda tiver registros exatos do antigo seed `BRLOBO2026`, rode primeiro a previa:

```bash
pnpm db:preview-demo-cleanup
```

Para aplicar a limpeza, confirme explicitamente no ambiente do comando:

```bash
DEMO_CLEANUP_APPLY=true CONFIRM_DEMO_CLEANUP=BRLOBO2026 pnpm db:preview-demo-cleanup
```

Esse script nao remove usuarios. Ele mira somente liga, campeonato, temporada, rodadas, partidas e registros vinculados ao antigo seed demo por codigo/nome exatos.

## Checagem

Depois do deploy, abra:

```text
https://sua-url-publica/api/health
```

Resposta esperada:

```json
{ "ok": true }
```

## Observacoes

- Nunca use o banco local para testes externos.
- Atualize `NEXTAUTH_URL` para a URL final do deploy. Login pode falhar se essa URL estiver errada.
- Nao rode `prisma migrate reset` em ambiente com usuarios reais.
