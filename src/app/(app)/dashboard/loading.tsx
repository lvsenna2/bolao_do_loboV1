import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardProfileLoading() {
  return (
    <Card className="mb-6">
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-56" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSectionsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando dados do dashboard">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </section>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <PageShell
      description="Carregando suas ligas, partidas abertas, palpites e ranking."
      eyebrow="Area do usuario"
      title="Dashboard"
    >
      <DashboardProfileLoading />
      <DashboardSectionsLoading />
    </PageShell>
  );
}
