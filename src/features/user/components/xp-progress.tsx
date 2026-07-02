import { getXpProgress } from "../data/user-data";

type XpProgressProps = {
  level: number;
  xp: number;
};

export function XpProgress({ level, xp }: XpProgressProps) {
  const progress = getXpProgress(xp);

  return (
    <div className="rounded-card border border-app-border bg-app-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-app-muted">Nivel atual</p>
          <p className="mt-1 text-2xl font-bold text-app-foreground">{level}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-app-muted">XP</p>
          <p className="mt-1 text-2xl font-bold text-brand-gold">{xp}</p>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-app-elevated">
        <div
          className="h-full rounded-full bg-brand-gold"
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-app-muted">Proximo marco em {progress.nextThreshold} XP.</p>
    </div>
  );
}
