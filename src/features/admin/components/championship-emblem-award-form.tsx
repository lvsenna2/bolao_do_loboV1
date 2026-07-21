"use client";

import { Award, Check, Globe2, Trophy } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { grantLeagueBadgeAction } from "@/features/admin/actions/admin-actions";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import type { AdminActionResult } from "@/features/admin/types";
import { OfficialEmblemArtwork, LeagueEmblem } from "@/features/xp/components/league-emblem";
import {
  officialLeagueEmblems,
  type LeagueEmblemScope,
  type OfficialLeagueEmblemKey
} from "@/features/xp/constants/league-emblems";
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
  const [userId, setUserId] = useState("");
  const [emblemKey, setEmblemKey] = useState<OfficialLeagueEmblemKey>("ROUND_HIGHLIGHT");
  const [scope, setScope] = useState<LeagueEmblemScope>("CHAMPIONSHIP");
  const selectedChampionship = championships.find((item) => item.id === championshipId);
  const selectedEmblem = officialLeagueEmblems.find((item) => item.key === emblemKey)!;
  const participantIds = useMemo(
    () => new Set(selectedChampionship?.participantIds ?? []),
    [selectedChampionship]
  );
  const participants = users.filter((user) => participantIds.has(user.id));

  function selectEmblem(key: OfficialLeagueEmblemKey) {
    const emblem = officialLeagueEmblems.find((item) => item.key === key)!;
    setEmblemKey(key);
    setScope(emblem.recommendedScope);
  }

  return (
    <form action={action} className="mt-4 space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Campeonato</span>
          <select
            className={inputClass}
            name="championshipId"
            onChange={(event) => {
              setChampionshipId(event.target.value);
              setUserId("");
            }}
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
          <select
            className={inputClass}
            disabled={!championshipId}
            name="userId"
            onChange={(event) => setUserId(event.target.value)}
            required
            value={userId}
          >
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
          <span className="text-sm font-medium text-app-foreground">Onde sera exibido</span>
          <select
            className={inputClass}
            name="scope"
            onChange={(event) => setScope(event.target.value as LeagueEmblemScope)}
            value={scope}
          >
            <option value="CHAMPIONSHIP">Somente neste campeonato</option>
            <option value="UNIVERSAL">Universal: todas as ligas</option>
          </select>
        </label>
      </div>

      <fieldset className="border-t border-app-border pt-5">
        <legend className="flex items-center gap-2 pr-3 text-sm font-semibold text-app-foreground">
          <Trophy aria-hidden className="h-4 w-4 text-brand-gold" />
          Escolha a insignia oficial
        </legend>
        <input name="emblemKey" type="hidden" value={emblemKey} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {officialLeagueEmblems.map((emblem) => {
            const selected = emblem.key === emblemKey;

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "relative grid min-h-32 grid-cols-[68px_minmax(0,1fr)] items-center gap-3 rounded-control border bg-black/35 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold",
                  selected
                    ? "border-brand-gold shadow-[0_0_20px_rgba(244,180,26,0.14)]"
                    : "border-app-border hover:border-brand-gold/60"
                )}
                key={emblem.key}
                onClick={() => selectEmblem(emblem.key)}
                type="button"
              >
                <OfficialEmblemArtwork className="w-16" emblem={emblem} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-app-foreground">
                    {emblem.title}
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-app-muted">
                    {emblem.description}
                  </span>
                  {emblem.recommendedScope === "UNIVERSAL" ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300">
                      <Globe2 aria-hidden className="h-3 w-3" />
                      Universal recomendado
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-black">
                    <Check aria-hidden className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 border-t border-app-border pt-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-app-foreground">Justificativa opcional</span>
          <input
            className={inputClass}
            maxLength={240}
            name="reason"
            placeholder={selectedEmblem.description}
          />
        </label>

        <div className="rounded-control border border-brand-gold/30 bg-black/30 p-4">
          <p className="text-xs font-semibold uppercase text-brand-gold">Previa no ranking</p>
          <div className="mt-4">
            <LeagueEmblem
              emblem={{
                badge: { title: selectedEmblem.title },
                championship: { name: selectedChampionship?.label ?? "Campeonato" },
                customTitle: selectedEmblem.title,
                emblemColor: "#F4B41A",
                emblemIcon: "OFFICIAL",
                emblemKey,
                emblemStyle: "CATALOG",
                id: "preview",
                isUniversal: scope === "UNIVERSAL"
              }}
            />
          </div>
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
        disabled={!championshipId || !userId || participants.length === 0}
        pendingLabel="Atribuindo..."
      >
        <Award aria-hidden className="h-4 w-4" />
        Atribuir insignia
      </AdminSubmitButton>
    </form>
  );
}
