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
  const levelLabel = progress
    ? `${progress.currentLevel.medal} ${progress.currentLevel.name}`
    : `Nivel ${level}`;
  const nextLabel = progress?.nextLevel
    ? `${progress.remainingXp} XP para ${progress.nextLevel.name}`
    : `Proximo marco em ${fallbackProgress.nextThreshold} XP.`;

  return (
    <div className="overflow-hidden rounded-card border border-brand-gold/30 bg-app-surface p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-app-muted">Patente atual</p>
          <p className="mt-1 text-2xl font-bold text-app-foreground">{levelLabel}</p>
          {progress?.discountPercent ? (
            <p className="mt-1 text-xs font-semibold text-brand-gold">
              {progress.discountPercent}% de desconto em ligas pagas
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-app-muted">XP</p>
          <p className="mt-1 text-2xl font-bold text-brand-gold">{xp}</p>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-app-elevated">
        <div
          className="h-full rounded-full bg-brand-gold transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-app-muted">{nextLabel}</p>
    </div>
  );
}
