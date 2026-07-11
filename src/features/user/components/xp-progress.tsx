import { getXpProgress } from "../data/user-data";
import type { XpProgressView } from "@/features/xp/services/xp-service";

type XpProgressProps = {
  level: number;
  progress?: XpProgressView | null;
  xp: number;
};

export function XpProgress({ level, progress, xp }: XpProgressProps) {
  const fallbackProgress = getXpProgress(xp);
  const percentage = progress?.progress ?? fallbackProgress.progress;
  const levelColor = progress?.currentLevel.color ?? "#F59E0B";
  const levelLabel = progress ? progress.currentLevel.name : `Nivel ${level}`;
  const medal = progress?.currentLevel.medal ?? "XP";
  const nextLabel = progress?.nextLevel
    ? `${progress.remainingXp} XP para ${progress.nextLevel.name}`
    : `Proximo marco em ${fallbackProgress.nextThreshold} XP.`;
  const nextLevelName = progress?.nextLevel?.name ?? "Patente maxima";

  return (
    <div
      className="xp-progress-card relative overflow-hidden rounded-card border bg-app-surface p-5 shadow-soft"
      style={{ borderColor: `${levelColor}66` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand-gold/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="xp-medal-breathe inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-2xl shadow-soft"
            style={{
              backgroundColor: `${levelColor}22`,
              borderColor: `${levelColor}88`,
              color: levelColor
            }}
          >
            {medal}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-gold">
              Patente atual
            </p>
            <p className="mt-1 truncate text-2xl font-bold text-app-foreground">{levelLabel}</p>
            {progress?.discountPercent ? (
              <p className="mt-1 text-xs font-semibold text-brand-gold">
                {progress.discountPercent}% de desconto em ligas pagas
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium text-app-muted">XP</p>
          <p className="mt-1 text-2xl font-bold text-brand-gold">{xp}</p>
        </div>
      </div>
      <div className="relative mt-5 h-4 overflow-hidden rounded-full bg-app-elevated ring-1 ring-white/10">
        <div
          className="xp-progress-fill h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
          style={{
            background: `linear-gradient(90deg, #f59e0b, ${levelColor}, #facc15)`,
            width: `${percentage}%`
          }}
        />
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-control border border-app-border bg-app-background p-3">
          <p className="font-semibold text-app-muted">Progresso</p>
          <p className="mt-1 text-base font-bold text-app-foreground">{Math.round(percentage)}%</p>
        </div>
        <div className="rounded-control border border-app-border bg-app-background p-3">
          <p className="font-semibold text-app-muted">Proxima</p>
          <p className="mt-1 text-base font-bold text-app-foreground">{nextLevelName}</p>
        </div>
        <div className="rounded-control border border-app-border bg-app-background p-3">
          <p className="font-semibold text-app-muted">Meta</p>
          <p className="mt-1 text-base font-bold text-brand-gold">{nextLabel}</p>
        </div>
      </div>
    </div>
  );
}
