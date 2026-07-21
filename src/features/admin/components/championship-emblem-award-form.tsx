"use client";

import { Award, Check } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { grantLeagueBadgeAction } from "@/features/admin/actions/admin-actions";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import type { AdminActionResult } from "@/features/admin/types";
import {
  leagueEmblemCategories,
  leagueEmblemColors,
  leagueEmblemIcons,
  leagueEmblemStyles,
  type LeagueEmblemCategory
} from "@/features/xp/constants/league-emblems";
import { LeagueEmblem } from "@/features/xp/components/league-emblem";
import { cn } from "@/lib/utils";

type ChampionshipOption = {
  id: string;
  label: string;
  logo: string | null;
  participantIds: string[];
};

type UserOption = {
  email: string;
  id: string;
  name: string;
};

type ChampionshipEmblemAwardFormProps = {
  championships: ChampionshipOption[];
  users: UserOption[];
};

const inputClass =
  "h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";
const initialState: AdminActionResult = { ok: true, message: "" };

export function ChampionshipEmblemAwardForm({
  championships,
  users
}: ChampionshipEmblemAwardFormProps) {
  const [state, action] = useActionState(
    async (_state: AdminActionResult, formData: FormData) => grantLeagueBadgeAction(formData),
    initialState
  );
  const [championshipId, setChampionshipId] = useState("");
  const [category, setCategory] = useState<LeagueEmblemCategory>("CHAMPION");
  const [color, setColor] = useState("#F4B41A");
  const [emblemStyle, setEmblemStyle] = useState("MEDAL");
  const [emblemIcon, setEmblemIcon] = useState("TROPHY");
  const [customTitle, setCustomTitle] = useState("");
  const selectedChampionship = championships.find((item) => item.id === championshipId);
  const categoryDefinition = leagueEmblemCategories.find((item) => item.key === category)!;
  const participantIds = useMemo(
    () => new Set(selectedChampionship?.participantIds ?? []),
    [selectedChampionship]
  );
  const participants = users.filter((user) => participantIds.has(user.id));

  return (
    <form action={action} className="mt-4 space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Campeonato</span>
          <select
            className={inputClass}
            name="championshipId"
            onChange={(event) => setChampionshipId(event.target.value)}
            required
            value={championshipId}
          >
            <option value="">Selecione o campeonato</option>
            {championships.map((championship) => (
              <option key={championship.id} value={championship.id}>
                {championship.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Participante</span>
          <select className={inputClass} disabled={!championshipId} name="userId" required>
            <option value="">
              {championshipId ? "Selecione o participante" : "Escolha primeiro o campeonato"}
            </option>
            {participants.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} | {user.email}
              </option>
            ))}
          </select>
          {championshipId && participants.length === 0 ? (
            <span className="block text-xs text-amber-300">
              Nenhum participante ativo nas ligas deste campeonato.
            </span>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Atribuicao</span>
          <select
            className={inputClass}
            name="category"
            onChange={(event) => setCategory(event.target.value as LeagueEmblemCategory)}
            value={category}
          >
            {leagueEmblemCategories.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 border-t border-app-border pt-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Titulo personalizado</span>
              <input
                className={inputClass}
                maxLength={100}
                name="customTitle"
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder={categoryDefinition.defaultTitle}
                value={customTitle}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Estilo</span>
              <select
                className={inputClass}
                name="emblemStyle"
                onChange={(event) => setEmblemStyle(event.target.value)}
                value={emblemStyle}
              >
                {leagueEmblemStyles.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Simbolo</span>
              <select
                className={inputClass}
                name="emblemIcon"
                onChange={(event) => setEmblemIcon(event.target.value)}
                value={emblemIcon}
              >
                {leagueEmblemIcons.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-app-foreground">Cor da insignia</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {leagueEmblemColors.map((item) => (
                <button
                  aria-label={item.label}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                    color === item.value ? "border-white" : "border-transparent"
                  )}
                  key={item.value}
                  onClick={() => setColor(item.value)}
                  style={{ backgroundColor: item.value }}
                  title={item.label}
                  type="button"
                >
                  {color === item.value ? (
                    <Check aria-hidden className="h-4 w-4 text-black" />
                  ) : null}
                </button>
              ))}
              <label className="inline-flex h-9 items-center gap-2 rounded-control border border-app-border px-2 text-xs text-app-muted">
                Personalizada
                <input
                  aria-label="Cor personalizada"
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                  name="emblemColor"
                  onChange={(event) => setColor(event.target.value.toUpperCase())}
                  type="color"
                  value={color}
                />
              </label>
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app-foreground">Descricao opcional</span>
            <input
              className={inputClass}
              maxLength={240}
              name="reason"
              placeholder="Ex.: maior pontuacao do Brasileirao 2026"
            />
          </label>
        </div>

        <div className="rounded-control border border-brand-gold/30 bg-black/30 p-4">
          <p className="text-xs font-semibold uppercase text-brand-gold">Previa no ranking</p>
          <div className="mt-5">
            <LeagueEmblem
              emblem={{
                badge: { title: categoryDefinition.defaultTitle },
                championship: { name: selectedChampionship?.label ?? "Campeonato" },
                customTitle: customTitle || null,
                emblemColor: color,
                emblemIcon,
                emblemStyle,
                id: "preview"
              }}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-app-muted">
            A insignia aparecera ao lado do participante nos rankings deste campeonato.
          </p>
        </div>
      </div>

      {state.message ? (
        <p
          aria-live="polite"
          className={cn(
            "rounded-control border px-3 py-2 text-sm",
            state.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          )}
        >
          {state.message}
        </p>
      ) : null}

      <AdminSubmitButton
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60 sm:w-auto"
        disabled={!championshipId || participants.length === 0}
        pendingLabel="Atribuindo..."
      >
        <Award aria-hidden className="h-4 w-4" />
        Atribuir insignia
      </AdminSubmitButton>
    </form>
  );
}
