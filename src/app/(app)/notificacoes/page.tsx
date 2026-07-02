import { CheckCheck } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/server/auth/session";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "@/features/user/actions/user-actions";
import { UserAlert } from "@/features/user/components/user-alert";
import { formatDate, getUserNotifications } from "@/features/user/data/user-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const filters = [
  { href: "/notificacoes", label: "Todas", value: "all" },
  { href: "/notificacoes?filter=unread", label: "Nao lidas", value: "unread" },
  { href: "/notificacoes?filter=system", label: "Sistema", value: "system" },
  { href: "/notificacoes?filter=payment", label: "Pagamentos", value: "payment" }
];

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const sessionUser = await requireUser();
  const params = await searchParams;
  const result = await getUserNotifications(sessionUser.id, params);
  const { filter, items, unread } = result.data;

  return (
    <PageShell
      actions={
        <form action={markAllNotificationsReadAction}>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-button bg-brand-blue px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            disabled={unread === 0}
            type="submit"
          >
            <CheckCheck aria-hidden className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        </form>
      }
      description="Central de resultados, pagamentos, convites, conquistas e avisos do sistema."
      eyebrow="Area do usuario"
      title="Notificacoes"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Minhas notificacoes</CardTitle>
              <CardDescription>{unread} notificacoes nao lidas.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Link
                  className={cn(
                    buttonVariants({ size: "sm", variant: "secondary" }),
                    filter === item.value ? "border-brand-blue text-brand-blue" : ""
                  )}
                  href={item.href as Route}
                  key={item.value}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 ? (
            items.map((notification) => (
              <article
                className="rounded-card border border-app-border bg-app-background p-4"
                key={notification.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-app-foreground">{notification.title}</h2>
                      <Badge>{notification.type}</Badge>
                      {!notification.readAt ? <Badge tone="warning">Nao lida</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-app-muted">{notification.body}</p>
                    <p className="mt-3 text-xs text-app-muted">
                      Recebida em {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input name="notificationId" type="hidden" value={notification.id} />
                      <button
                        className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-blue hover:text-brand-blue"
                        type="submit"
                      >
                        Marcar como lida
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              description="Nenhuma notificacao encontrada para o filtro selecionado."
              title="Sem notificacoes"
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
