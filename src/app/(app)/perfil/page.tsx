import { Download, KeyRound, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/server/auth/session";
import { DeleteAccountForm } from "@/features/user/components/delete-account-form";
import { PasswordForm } from "@/features/user/components/password-form";
import { ProfileForm } from "@/features/user/components/profile-form";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { XpProgress } from "@/features/user/components/xp-progress";
import { formatDate, getUserProfileData } from "@/features/user/data/user-data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const result = await getUserProfileData(sessionUser.id);
  const { achievements, stats, user } = result.data;

  return (
    <PageShell
      actions={
        <Link
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          href={"/perfil/exportar" as Route}
        >
          <Download aria-hidden className="h-4 w-4" />
          Exportar dados
        </Link>
      }
      description="Gerencie seus dados pessoais, senha, preferencia visual e exportacao."
      eyebrow="Area do usuario"
      title="Perfil"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      {user ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Dados do perfil</CardTitle>
                <CardDescription>Nome, username, foto, idioma e tema.</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle>Alterar senha</CardTitle>
                <CardDescription>Atualize sua senha mantendo os criterios minimos.</CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordForm />
              </CardContent>
            </Card>

            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <Trash2 aria-hidden className="h-5 w-5" />
                  Excluir conta
                </CardTitle>
                <CardDescription>
                  A exclusao marca sua conta como removida e encerra a sessao atual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteAccountForm />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16" name={user.name} src={user.avatarUrl} />
                  <div>
                    <p className="text-xl font-bold text-app-foreground">{user.name}</p>
                    <p className="text-sm text-app-muted">@{user.username}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge tone="info">{user.role}</Badge>
                      <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm text-app-muted">
                  <p>E-mail: {user.email}</p>
                  <p>Conta criada: {formatDate(user.createdAt)}</p>
                  <p>Ultimo login: {formatDate(user.lastLoginAt)}</p>
                </div>
              </CardContent>
            </Card>

            <XpProgress level={user.level} xp={user.xp} />

            <section className="grid gap-4">
              <UserStatCard
                description="Total registrado"
                icon={UserRound}
                label="Palpites"
                value={stats.guesses}
              />
              <UserStatCard
                description="Pontuacao acumulada"
                icon={KeyRound}
                label="Pontos"
                value={stats.points}
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Conquistas</CardTitle>
                <CardDescription>Ultimas badges desbloqueadas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {achievements.length > 0 ? (
                  achievements.map((achievement) => (
                    <div key={achievement.id}>
                      <p className="font-medium text-app-foreground">{achievement.badge.title}</p>
                      <p className="text-xs text-app-muted">{achievement.badge.description}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    description="Conquistas desbloqueadas aparecerao no seu perfil."
                    title="Nenhuma conquista"
                  />
                )}
              </CardContent>
            </Card>
          </aside>
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
