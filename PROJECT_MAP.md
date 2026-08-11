# PROJECT_MAP

## Stack

- Runtime/framework: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- Package manager: pnpm 11
- Database/storage: Prisma 6 with relational database

## Entry points

- App: `src/app/`
- API/backend: `src/app/api/`, `src/server/`
- Frontend: `src/components/`, `src/features/*/components/`

## Key areas

- Authentication: `src/server/auth/`, NextAuth route under `src/app/api/auth/`
- Business logic: `src/features/`
- Data access: `src/features/*/data/`, `src/server/db/`
- UI/components: `src/components/`, `src/features/*/components/`
- Tests: colocated `*.test.ts(x)` files and `tests/e2e/`

## Important paths

- `src/app/(app)/` - authenticated user routes
- `src/app/admin/` - administrative routes
- `src/features/` - feature-owned data, services, actions, and UI
- `prisma/` - schema and migrations

## Data flow

- Request -> App Router page/route -> feature data/service/action -> Prisma -> rendered response

## Notes

- Authenticated pages are predominantly dynamic and share `AppShell`.
