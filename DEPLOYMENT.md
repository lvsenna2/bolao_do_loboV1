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
API_FOOTBALL_KEY=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

Para gerar `NEXTAUTH_SECRET` localmente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

5. Aplique migrations no banco remoto:

```bash
pnpm prisma:deploy
```

6. Para popular o ambiente de testes com o Brasileirao ficticio:

```bash
ALLOW_DEMO_SEED=true pnpm seed:demo
```

Use esse seed apenas na homologacao inicial. Ele recria os dados ficticios da liga `BRLOBO2026`.

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

## Acessos de teste

- Admin: `admin@bolaodolobo.local` / `Admin@123`
- Usuario: `usuario@bolaodolobo.local` / `Usuario@123`
- Rival: `rival@bolaodolobo.local` / `Rival@123`

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
- O seed demo e destrutivo para os dados ficticios da liga de teste; use apenas enquanto estiver em homologacao.
