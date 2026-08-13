import type { Route } from "next";
import Link from "next/link";
import { Download, Fingerprint, LifeBuoy, Mail, Shield, Trash2 } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PasskeyManager } from "@/features/auth/components/passkey-manager";
import { DeleteAccountForm } from "@/features/user/components/delete-account-form";
import { PasswordForm } from "@/features/user/components/password-form";
import { ProfileForm } from "@/features/user/components/profile-form";
import { UserAlert } from "@/features/user/components/user-alert";
import { XpProgress } from "@/features/user/components/xp-progress";
import { formatDate, getUserProfileData } from "@/features/user/data/user-data";
import { SUPPORT_EMAIL, supportMailtoUrl } from "@/lib/support";
import { requireUser } from "@/server/auth/session";
import { withShortCache } from "@/server/cache/short-cache";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const getCachedUserProfileData = withShortCache("user-profile-page-data", getUserProfileData);

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const result = await getCachedUserProfileData(sessionUser.id);
  const { stats, user, xpProgress } = result.data;
  const passkeys = await prisma.webAuthnCredential.findMany({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, id: true, label: true, lastUsedAt: true },
    where: { userId: sessionUser.id }
  });

  return (
    <PageShell
      actions={
        <Link
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          href={"/perfil/exportar" as Route}
        >
          <Download aria-hidden className="h-4 w-4" />
          Exportar
        </Link>
      }
      description="Atualize seus dados, foto e seguranca da conta."
      eyebrow="Area do usuario"
      title="Perfil"
    >
      <UserAlert message={result.ok ? undefined : result.message} />
      {user ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <Avatar
                className="h-16 w-16"
                name={user.name}
                src={user.avatarUrl}
                userId={user.id}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-bold text-app-foreground">{user.name}</p>
                <p className="truncate text-sm text-app-muted">
                  @{user.username} | {user.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>
                    {user.status}
                  </Badge>
                  <Badge tone="warning">{user.xp} XP</Badge>
                  <Badge>{stats.points} pontos</Badge>
                  <Badge>{stats.guesses} palpites</Badge>
                  <Badge>Desde {formatDate(user.createdAt)}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  className={buttonVariants({ size: "sm", variant: "secondary" })}
                  href="/conquistas"
                >
                  Conquistas
                </Link>
                <Link
                  className={buttonVariants({ size: "sm", variant: "secondary" })}
                  href="/xp-ranking"
                >
                  Ranking XP
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Dados do perfil</CardTitle>
                <CardDescription>Nome, username, foto e preferencias.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm
                  defaultValues={{
                    avatarUrl: user.avatarUrl ?? "",
                    firstName: user.firstName ?? user.name.split(" ")[0] ?? "",
                    lastName: user.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "",
                    locale: user.locale,
                    theme:
                      user.theme === "light" || user.theme === "dark" || user.theme === "system"
                        ? user.theme
                        : "system",
                    username: user.username
                  }}
                />
              </CardContent>
            </Card>

            <aside className="space-y-5">
              <XpProgress progress={xpProgress} xp={user.xp} />
            </aside>
          </div>

          <section className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield aria-hidden className="h-5 w-5 text-brand-gold" />
                  Alterar senha
                </CardTitle>
                <CardDescription>Atualize sua senha de acesso.</CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint aria-hidden className="h-5 w-5 text-brand-gold" />
                  Login por biometria
                </CardTitle>
                <CardDescription>
                  Entre com Face ID, digital ou Windows Hello, sem digitar a senha.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasskeyManager
                  passkeys={passkeys.map((passkey) => ({
                    createdAt: passkey.createdAt.toISOString(),
                    id: passkey.id,
                    label: passkey.label,
                    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LifeBuoy aria-hidden className="h-5 w-5 text-brand-gold" />
                  Ajuda e suporte
                </CardTitle>
                <CardDescription>
                  Problema com saldo, saque, palpite ou login? Escreva para a gente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  className={buttonVariants({ size: "sm", variant: "secondary" })}
                  href={supportMailtoUrl(`Suporte - @${user.username}`)}
                >
                  <Mail aria-hidden className="h-4 w-4" />
                  {SUPPORT_EMAIL}
                </a>
                <p className="text-xs text-app-muted">
                  Responda sempre do e-mail cadastrado na conta para agilizarmos o atendimento.
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <Trash2 aria-hidden className="h-5 w-5" />
                  Excluir conta
                </CardTitle>
                <CardDescription>Esta acao encerra sua conta e a sessao atual.</CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteAccountForm />
              </CardContent>
            </Card>
          </section>
        </div>
      ) : (
        <EmptyState
          description="Nao foi possivel localizar os dados da sua conta."
          title="Perfil indisponivel"
        />
      )}
    </PageShell>
  );
}
