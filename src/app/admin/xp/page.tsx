import { Flame, History, Settings, Sparkles, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAchievementBadgeAction,
  createMissionAction,
  createXpLevelAction,
  createXpTypeConfigAction,
  grantManualXpAction,
  recalculateUserXpAction,
  updateLeagueXpEnabledAction,
  updateXpLevelAction,
  updateXpSettingsAction,
  updateXpTypeConfigAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminXpData, toCurrency } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

const grantManualXpFormAction = grantManualXpAction as unknown as FormAction;
const createAchievementBadgeFormAction = createAchievementBadgeAction as unknown as FormAction;
const createMissionFormAction = createMissionAction as unknown as FormAction;
const createXpLevelFormAction = createXpLevelAction as unknown as FormAction;
const createXpTypeConfigFormAction = createXpTypeConfigAction as unknown as FormAction;
const recalculateUserXpFormAction = recalculateUserXpAction as unknown as FormAction;
const updateLeagueXpEnabledFormAction = updateLeagueXpEnabledAction as unknown as FormAction;
const updateXpLevelFormAction = updateXpLevelAction as unknown as FormAction;
const updateXpSettingsFormAction = updateXpSettingsAction as unknown as FormAction;
const updateXpTypeConfigFormAction = updateXpTypeConfigAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function formatDate(date: Date) {
  return formatDateTimeInSaoPaulo(date);
}

export default async function AdminXpPage() {
  const result = await getAdminXpData();
  const {
    badges,
    events,
    levels,
    leagues,
    missions,
    paidLeagueMinimumEntryFee,
    stats,
    typeConfigs,
    users
  } = result.data;

  return (
    <PageShell
      description="Configure progressao, recompensas, descontos, historico e ajustes manuais."
      eyebrow="Administracao"
      title="XP e recompensas"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard
          description="Eventos auditados"
          icon={History}
          label="Historico"
          value={stats.totalEvents}
        />
        <AdminStatCard
          description="XP acumulado no sistema"
          icon={Sparkles}
          label="XP total"
          value={stats.totalXp}
        />
        <AdminStatCard
          description="Usuarios com progresso"
          icon={Trophy}
          label="Participantes"
          value={stats.usersWithXp}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Niveis e descontos</CardTitle>
              <CardDescription>Edite patentes, faixas de XP e beneficios pagos.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={createXpLevelFormAction}
                className="mb-4 grid gap-3 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 lg:grid-cols-[1fr_90px_120px_110px_110px_100px_90px_auto] lg:items-end"
              >
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Novo nivel</span>
                  <input className={inputClass} name="name" placeholder="Elite" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Key</span>
                  <input className={inputClass} name="key" placeholder="elite" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Medalha</span>
                  <input className={inputClass} name="medal" placeholder="*" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Cor</span>
                  <input className={inputClass} defaultValue="#FBBF24" name="color" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">XP min.</span>
                  <input className={inputClass} min={0} name="minXp" required type="number" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">XP max.</span>
                  <input className={inputClass} min={0} name="maxXp" type="number" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Ordem</span>
                  <input
                    className={inputClass}
                    defaultValue={levels.length + 1}
                    min={1}
                    name="sortOrder"
                    type="number"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <input name="active" type="hidden" value="false" />
                  <input defaultChecked name="active" type="checkbox" value="true" />
                  <input name="discountPercent" type="hidden" value="0" />
                  <AdminSubmitButton
                    className="h-10 rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                    pendingLabel="Criando..."
                  >
                    Criar
                  </AdminSubmitButton>
                </div>
              </form>
              <div className="space-y-3">
                {levels.map((level) => (
                  <form
                    action={updateXpLevelFormAction}
                    className="grid gap-3 rounded-control border border-app-border bg-app-background p-3 lg:grid-cols-[1.1fr_80px_120px_120px_120px_100px_auto] lg:items-end"
                    key={level.id}
                  >
                    <input name="levelId" type="hidden" value={level.id} />
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">Nome</span>
                      <input
                        className={inputClass}
                        defaultValue={level.name}
                        name="name"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">Medalha</span>
                      <input
                        className={inputClass}
                        defaultValue={level.medal}
                        name="medal"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">Cor</span>
                      <input
                        className={inputClass}
                        defaultValue={level.color}
                        name="color"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">XP min.</span>
                      <input
                        className={inputClass}
                        defaultValue={level.minXp}
                        min={0}
                        name="minXp"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">XP max.</span>
                      <input
                        className={inputClass}
                        defaultValue={level.maxXp ?? ""}
                        min={0}
                        name="maxXp"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-app-foreground">Desconto %</span>
                      <input
                        className={inputClass}
                        defaultValue={level.discountPercent}
                        max={100}
                        min={0}
                        name="discountPercent"
                        type="number"
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input name="active" type="hidden" value="false" />
                      <label className="flex items-center gap-2 text-xs font-semibold text-app-muted">
                        <input
                          defaultChecked={level.active}
                          name="active"
                          type="checkbox"
                          value="true"
                        />
                        Ativo
                      </label>
                      <AdminSubmitButton
                        className="h-10 rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                        pendingLabel="Salvando..."
                      >
                        Salvar
                      </AdminSubmitButton>
                    </div>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fontes de XP</CardTitle>
              <CardDescription>Valores usados pelo servico central de XP.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={createXpTypeConfigFormAction}
                className="mb-4 grid gap-3 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 lg:grid-cols-[140px_1fr_120px_auto] lg:items-end"
              >
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Key</span>
                  <input className={inputClass} name="key" placeholder="DAILY_LOGIN" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Nome</span>
                  <input className={inputClass} name="label" placeholder="Login diario" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">XP</span>
                  <input className={inputClass} name="amount" required type="number" />
                </label>
                <div className="flex items-center gap-2">
                  <input name="active" type="hidden" value="false" />
                  <input defaultChecked name="active" type="checkbox" value="true" />
                  <input name="description" type="hidden" value="" />
                  <AdminSubmitButton
                    className="h-10 rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                    pendingLabel="Criando..."
                  >
                    Criar
                  </AdminSubmitButton>
                </div>
              </form>
              <AdminTable>
                <AdminTableHead>
                  <tr>
                    <AdminTh>Fonte</AdminTh>
                    <AdminTh>XP</AdminTh>
                    <AdminTh>Status</AdminTh>
                    <AdminTh>Acoes</AdminTh>
                  </tr>
                </AdminTableHead>
                <AdminTableBody>
                  {typeConfigs.map((config) => (
                    <tr key={config.id}>
                      <AdminTd>
                        <p className="font-semibold">{config.label}</p>
                        <p className="text-xs text-app-muted">{config.key}</p>
                      </AdminTd>
                      <AdminTd>{config.amount}</AdminTd>
                      <AdminTd>
                        <Badge tone={config.active ? "success" : "neutral"}>
                          {config.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </AdminTd>
                      <AdminTd>
                        <form
                          action={updateXpTypeConfigFormAction}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input name="typeConfigId" type="hidden" value={config.id} />
                          <input
                            className={inputClass}
                            defaultValue={config.amount}
                            name="amount"
                            type="number"
                          />
                          <input name="active" type="hidden" value="false" />
                          <label className="flex items-center gap-2 text-xs font-semibold text-app-muted">
                            <input
                              defaultChecked={config.active}
                              name="active"
                              type="checkbox"
                              value="true"
                            />
                            Ativa
                          </label>
                          <AdminSubmitButton
                            className="h-10 rounded-button border border-app-border px-3 text-sm font-semibold transition hover:border-brand-gold hover:text-brand-gold"
                            pendingLabel="Salvando..."
                          >
                            Salvar
                          </AdminSubmitButton>
                        </form>
                      </AdminTd>
                    </tr>
                  ))}
                </AdminTableBody>
              </AdminTable>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ligas com XP</CardTitle>
              <CardDescription>
                Desative em ligas de teste ou eventos sem progressao.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {leagues.map((league) => (
                  <form
                    action={updateLeagueXpEnabledFormAction}
                    className="rounded-control border border-app-border bg-app-background p-3"
                    key={league.id}
                  >
                    <input name="leagueId" type="hidden" value={league.id} />
                    <input name="xpEnabled" type="hidden" value="false" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-app-foreground">{league.name}</p>
                        <p className="text-xs text-app-muted">
                          {league.championship.name} | {league.status}
                        </p>
                      </div>
                      <Badge tone={league.xpEnabled ? "success" : "neutral"}>
                        {league.xpEnabled ? "XP ativo" : "XP inativo"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm text-app-muted">
                        <input
                          defaultChecked={league.xpEnabled}
                          name="xpEnabled"
                          type="checkbox"
                          value="true"
                        />
                        Conceder XP nesta liga
                      </label>
                      <AdminSubmitButton
                        className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold transition hover:border-brand-gold hover:text-brand-gold"
                        pendingLabel="Salvando..."
                      >
                        Salvar
                      </AdminSubmitButton>
                    </div>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings aria-hidden className="h-5 w-5 text-brand-gold" />
                Configuracoes
              </CardTitle>
              <CardDescription>Valor minimo apos descontos nas ligas pagas.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateXpSettingsFormAction} className="space-y-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Valor minimo</span>
                  <input
                    className={inputClass}
                    defaultValue={paidLeagueMinimumEntryFee}
                    min={0}
                    name="paidLeagueMinimumEntryFee"
                    step="0.01"
                    type="number"
                  />
                </label>
                <p className="text-xs text-app-muted">
                  Atual: {toCurrency(paidLeagueMinimumEntryFee)}
                </p>
                <AdminSubmitButton
                  className="h-10 w-full rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                  pendingLabel="Salvando..."
                >
                  Salvar configuracao
                </AdminSubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajuste manual</CardTitle>
              <CardDescription>Use valor negativo para remover XP com auditoria.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={grantManualXpFormAction} className="space-y-3">
                <AdminSelect label="Usuario" name="userId" required>
                  <option value="">Selecione</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} | {item.email}
                    </option>
                  ))}
                </AdminSelect>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">XP</span>
                  <input
                    className={inputClass}
                    name="amount"
                    placeholder="-20 ou 50"
                    required
                    type="number"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-app-foreground">Motivo</span>
                  <input className={inputClass} maxLength={240} name="reason" required />
                </label>
                <AdminSubmitButton
                  className="h-10 w-full rounded-button bg-brand-gold px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                  pendingLabel="Aplicando..."
                >
                  Aplicar ajuste
                </AdminSubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recalcular XP</CardTitle>
              <CardDescription>Recria o saldo do usuario a partir do historico.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={recalculateUserXpFormAction} className="space-y-3">
                <AdminSelect label="Usuario" name="userId">
                  <option value="all">Todos os usuarios</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} | {item.email}
                    </option>
                  ))}
                </AdminSelect>
                <AdminSubmitButton
                  className="h-10 w-full rounded-button border border-app-border px-3 text-sm font-semibold transition hover:border-brand-gold hover:text-brand-gold"
                  pendingLabel="Recalculando..."
                >
                  Recalcular
                </AdminSubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame aria-hidden className="h-5 w-5 text-brand-gold" />
                Missoes
              </CardTitle>
              <CardDescription>Missoes cadastradas para recompensas bonus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form
                action={createMissionFormAction}
                className="space-y-3 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={inputClass} name="key" placeholder="WEEKLY_CUSTOM" required />
                  <input className={inputClass} name="title" placeholder="Titulo" required />
                  <input
                    className={inputClass}
                    name="type"
                    placeholder="GUESSES_SUBMITTED"
                    required
                  />
                  <input
                    className={inputClass}
                    name="target"
                    placeholder="Meta"
                    required
                    type="number"
                  />
                  <input
                    className={inputClass}
                    name="xpReward"
                    placeholder="XP bonus"
                    required
                    type="number"
                  />
                  <input className={inputClass} name="startsAt" required type="datetime-local" />
                  <input className={inputClass} name="endsAt" required type="datetime-local" />
                </div>
                <input className={inputClass} name="description" placeholder="Descricao" required />
                <input name="active" type="hidden" value="false" />
                <label className="flex items-center gap-2 text-sm text-app-muted">
                  <input defaultChecked name="active" type="checkbox" value="true" />
                  Ativa
                </label>
                <AdminSubmitButton
                  className="h-10 w-full rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                  pendingLabel="Criando..."
                >
                  Criar missao
                </AdminSubmitButton>
              </form>
              {missions.map((mission) => (
                <div
                  className="rounded-control border border-app-border bg-app-background p-3"
                  key={mission.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-app-foreground">{mission.title}</p>
                    <Badge tone={mission.active ? "success" : "neutral"}>
                      {mission.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-app-muted">
                    {mission.target} meta | {mission.xpReward} XP | {formatDate(mission.startsAt)}{" "}
                    ate {formatDate(mission.endsAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Conquistas</CardTitle>
          <CardDescription>Crie definicoes de conquistas para expansoes futuras.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createAchievementBadgeFormAction}
            className="mb-4 grid gap-3 lg:grid-cols-[140px_1fr_1fr_160px_auto] lg:items-end"
          >
            <input className={inputClass} name="key" placeholder="CUSTOM_BADGE" required />
            <input className={inputClass} name="title" placeholder="Titulo" required />
            <input className={inputClass} name="description" placeholder="Descricao" required />
            <select className={inputClass} defaultValue="COMMON" name="rarity">
              <option value="COMMON">COMMON</option>
              <option value="RARE">RARE</option>
              <option value="EPIC">EPIC</option>
              <option value="LEGENDARY">LEGENDARY</option>
            </select>
            <AdminSubmitButton
              className="h-10 rounded-button bg-brand-gold px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
              pendingLabel="Criando..."
            >
              Criar
            </AdminSubmitButton>
          </form>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {badges.map((badge) => (
              <div
                className="rounded-control border border-app-border bg-app-background p-3"
                key={badge.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-app-foreground">{badge.title}</p>
                  <Badge>{badge.rarity}</Badge>
                </div>
                <p className="mt-1 text-xs text-app-muted">{badge.key ?? "sem-key"}</p>
                <p className="mt-2 text-sm text-app-muted">{badge.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Historico recente de XP</CardTitle>
          <CardDescription>Livro-caixa auditavel de eventos concedidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Tipo</AdminTh>
                <AdminTh>XP</AdminTh>
                <AdminTh>Liga</AdminTh>
                <AdminTh>Admin</AdminTh>
                <AdminTh>Data</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {events.map((event) => (
                <tr key={event.id}>
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      <Avatar
                        alt={event.user.name}
                        name={event.user.name}
                        src={event.user.avatarUrl}
                      />
                      <div>
                        <p className="font-semibold">{event.user.name}</p>
                        <p className="text-xs text-app-muted">{event.user.email}</p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>{event.type}</AdminTd>
                  <AdminTd>
                    <Badge tone={event.amount >= 0 ? "success" : "warning"}>
                      {event.amount > 0 ? "+" : ""}
                      {event.amount}
                    </Badge>
                  </AdminTd>
                  <AdminTd>{event.league?.name ?? "-"}</AdminTd>
                  <AdminTd>
                    {event.admin ? `${event.admin.name} | ${event.admin.email}` : "-"}
                  </AdminTd>
                  <AdminTd>{formatDate(event.createdAt)}</AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
        </CardContent>
      </Card>
    </PageShell>
  );
}
