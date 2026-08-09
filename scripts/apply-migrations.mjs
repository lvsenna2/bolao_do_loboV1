// Aplica as migrations pendentes antes do build quando existe um banco configurado.
// A Vercel usa o Build Command sobrescrito (`pnpm build`), entao o passo precisa
// morar aqui e nao em um script `vercel-build` separado.
import { spawnSync } from "node:child_process";

if (process.env.SKIP_PRISMA_MIGRATE === "1") {
  console.info("[migrations] SKIP_PRISMA_MIGRATE=1: pulando prisma migrate deploy.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.info("[migrations] DATABASE_URL ausente: pulando prisma migrate deploy.");
  process.exit(0);
}

console.info("[migrations] Aplicando migrations pendentes...");
const result = spawnSync("prisma", ["migrate", "deploy"], {
  shell: true,
  stdio: "inherit"
});

if (result.status !== 0) {
  console.error("[migrations] Falha ao aplicar as migrations. Build interrompido.");
  process.exit(result.status ?? 1);
}
