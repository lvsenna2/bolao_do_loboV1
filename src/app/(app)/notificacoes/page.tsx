import {
  Award,
  CalendarCheck,
  CheckCheck,
  ClipboardCheck,
  Crosshair,
  Flame,
  Gift,
  Medal,
  Settings,
  Sparkles,
  Target,
  Trophy
} from "lucide-react";
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
  { href: "/notificacoes?filter=xp", label: "XP", value: "xp" },
  { href: "/notificacoes?filter=system", label: "Sistema", value: "system" },
  { href: "/notificacoes?filter=payment", label: "Pagamentos", value: "payment" }
];

const xpIconMap = {
  award: Award,
  "calendar-check": CalendarCheck,
  "clipboard-check": ClipboardCheck,
  crosshair: Crosshair,
  flame: Flame,
  gift: Gift,
  medal: Medal,
  settings: Settings,
  sparkles: Sparkles,
  target: Target,
  trophy: Trophy
};

function getNotificationIcon(icon: string | null, type: string) {
  if (type !== "XP") {
    return Sparkles;
  }

  return xpIconMap[icon as keyof typeof xpIconMap] ?? Sparkles;
}

function getPageHref(filter: string, page: number) {
  const params = new URLSearchParams();

  if (filter !== "all") {
    params.set("filter", filter);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/notificacoes?${query}` : "/notificacoes";
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const sessionUser = await requireUser();
  const params = await searchParams;
  const result = await getUserNotifications(sessionUser.id, params);
  const { filter, filterUnread, items, page, total, totalPages, unread } = result.data;

  return (
    <PageShell
      actions={
        <form action={markAllNotificationsReadAction}>
          <input name="filter" type="hidden" value={filter} />
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-button bg-brand-blue px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            disabled={filterUnread === 0}
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
              <CardDescription>
                {unread} notificacoes nao lidas. {total} encontrada(s) neste filtro.
              </CardDescription>
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
            items.map((notification) => {
              const Icon = getNotificationIcon(notification.icon, notification.type);

              return (
                <article
                  className="rounded-card border border-app-border bg-app-background p-4"
                  key={notification.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-button border border-app-border bg-app-surface text-brand-gold">
                        <Icon aria-hidden className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-app-foreground">
                            {notification.title}
                          </h2>
                          <Badge>{notification.type}</Badge>
                          {notification.xpReceived !== null && notification.type === "XP" ? (
                            <Badge tone={notification.xpReceived >= 0 ? "warning" : "neutral"}>
                              {notification.xpReceived >= 0 ? "+" : ""}
                              {notification.xpReceived} XP
                            </Badge>
                          ) : null}
                          {!notification.isRead ? <Badge tone="warning">Nao lida</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-app-muted">
                          {notification.message ?? notification.body}
                        </p>
                        <p className="mt-3 text-xs text-app-muted">
                          Recebida em {formatDate(notification.createdAt)}
                          {notification.levelAfter ? ` | Patente ${notification.levelAfter}` : ""}
                        </p>
                      </div>
                    </div>
                    {!notification.isRead ? (
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
              );
            })
          ) : (
            <EmptyState
              description="Nenhuma notificacao encontrada para o filtro selecionado."
              title="Sem notificacoes"
            />
          )}

          {totalPages > 1 ? (
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-app-muted">
                Pagina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Link
                  aria-disabled={page <= 1}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "secondary" }),
                    page <= 1 ? "pointer-events-none opacity-50" : ""
                  )}
                  href={getPageHref(filter, Math.max(1, page - 1)) as Route}
                >
                  Anterior
                </Link>
                <Link
                  aria-disabled={page >= totalPages}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "secondary" }),
                    page >= totalPages ? "pointer-events-none opacity-50" : ""
                  )}
                  href={getPageHref(filter, Math.min(totalPages, page + 1)) as Route}
                >
                  Proxima
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}
