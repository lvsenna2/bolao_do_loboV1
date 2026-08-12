# Configuracao em outro notebook

Este guia prepara uma maquina Windows para desenvolver o Bolao do Lobo sem copiar
senhas pelo Git e sem alterar automaticamente o banco de producao.

## Requisitos

- Git para Windows
- Node.js 22 LTS
- Docker Desktop, apenas se quiser PostgreSQL local
- Acesso ao repositorio GitHub

## Primeira instalacao

```powershell
git clone https://github.com/lvsenna2/bolao_do_loboV1.git
Set-Location bolao_do_loboV1
git checkout main
powershell -ExecutionPolicy Bypass -File .\scripts\setup-notebook.ps1
```

O script:

- verifica Git, Node e pnpm;
- preserva um `.env.local` existente;
- cria `.env.local` a partir de `.env.example` quando necessario;
- instala exatamente as dependencias do lockfile;
- gera o Prisma Client;
- nao executa migrations nem limpa dados.

## Variaveis de ambiente

Preencha `.env.local` com credenciais proprias. Nunca envie esse arquivo ao GitHub.
Para trabalhar somente na interface, ainda e necessario apontar `DATABASE_URL` para um
banco compativel. Use credenciais de desenvolvimento sempre que possivel.

Segredos de producao devem continuar no painel da Vercel. Se for indispensavel usar
as variaveis da Vercel no notebook, autentique a CLI e baixe-as diretamente, sem
enviar o arquivo por mensagem:

```powershell
npx vercel link
npx vercel env pull .env.local
```

Trate o arquivo baixado como segredo. Ele ja esta ignorado pelo Git.

## Banco local recomendado

```powershell
docker compose up -d postgres
pnpm prisma:deploy
pnpm dev
```

Abra `http://localhost:3000`. O banco local usa a URL de exemplo existente em
`.env.example`.

Nao execute `prisma migrate reset`, scripts de limpeza ou seeds contra o banco de
producao. Para apenas consultar o schema visualmente, use `pnpm prisma:studio`.

## Trabalho diario entre computadores

Antes de iniciar:

```powershell
git checkout main
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm dev
```

Antes de trocar de computador, confirme que as alteracoes desejadas foram commitadas
e enviadas. Arquivos `.env*`, `.vercel`, `node_modules` e builds locais nao devem ser
versionados.

## Verificacoes antes de publicar

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

As migrations de producao devem ser aplicadas uma unica vez com `pnpm prisma:deploy`,
fora do build da Vercel, para evitar o erro de advisory lock `P1002`.

## Problemas comuns

- `P1002`: ha outra migration segurando o lock. Aguarde/cancele o outro processo e
  execute `pnpm prisma:deploy` uma unica vez.
- Login retorna para a tela inicial: confira `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` e
  `NEXTAUTH_SECRET`.
- Prisma Client ausente: execute `pnpm prisma:generate`.
- Porta 3000 ocupada: execute `pnpm dev -- --port 3001`.
