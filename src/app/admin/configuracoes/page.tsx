import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveGeneralSettingsAction } from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import { getAdminSettings } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

const saveGeneralSettingsFormAction = saveGeneralSettingsAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export default async function AdminSettingsPage() {
  const result = await getAdminSettings();
  const settings = result.data;

  return (
    <PageShell
      description="Parametros operacionais basicos da plataforma."
      eyebrow="Administracao"
      title="Configuracoes"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <Card>
        <CardHeader>
          <CardTitle>Configuracoes gerais</CardTitle>
          <CardDescription>
            Estes valores estruturam identidade, idioma, moeda e integracoes iniciais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveGeneralSettingsFormAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Nome da plataforma</span>
              <input
                className={inputClass}
                defaultValue={settings.platformName}
                name="platformName"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Moeda</span>
              <input className={inputClass} defaultValue={settings.currency} name="currency" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Idioma</span>
              <input className={inputClass} defaultValue={settings.language} name="language" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Fuso horario</span>
              <input className={inputClass} defaultValue={settings.timezone} name="timezone" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">E-mail de suporte</span>
              <input
                className={inputClass}
                defaultValue={settings.supportEmail}
                name="supportEmail"
                type="email"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">API de futebol</span>
              <input
                className={inputClass}
                defaultValue={settings.footballApiProvider}
                name="footballApiProvider"
                placeholder="API-Football"
              />
            </label>
            <div className="md:col-span-2">
              <AdminSubmitButton
                className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                pendingLabel="Salvando..."
              >
                Salvar configuracoes
              </AdminSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
