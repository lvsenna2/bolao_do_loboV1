import { CalendarClock, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatGuessDate, getPredictionLabel, type RecentGuessView } from "../data/guess-data";

type GuessHistoryCardProps = {
  guess: RecentGuessView;
};

export function GuessHistoryCard({ guess }: GuessHistoryCardProps) {
  const score =
    guess.guess.homePrediction === null || guess.guess.awayPrediction === null
      ? "-"
      : `${guess.guess.homePrediction} x ${guess.guess.awayPrediction}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={guess.canEdit ? "info" : "neutral"}>
              {guess.canEdit ? "Editavel" : "Bloqueado"}
            </Badge>
            {guess.guess.score ? (
              <Badge tone={guess.guess.score.totalPoints > 0 ? "success" : "neutral"}>
                {guess.guess.score.totalPoints} pts
              </Badge>
            ) : null}
            {guess.guess.joker ? (
              <Badge tone="warning">
                <Wand2 aria-hidden className="mr-1 h-3.5 w-3.5" />
                Curinga
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="truncate text-sm font-semibold text-app-foreground">
              {guess.homeTeam.name} x {guess.awayTeam.name}
            </p>
            <p className="text-xs text-app-muted">
              {guess.championshipName} - {guess.roundLabel}
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-left text-sm sm:min-w-52 sm:text-right">
          <p className="text-xl font-bold text-app-foreground">{score}</p>
          <p className="text-app-muted">{getPredictionLabel(guess.guess.prediction)}</p>
          {guess.guess.score ? (
            <p className="text-xs text-app-muted">
              {guess.guess.score.exactScore
                ? "Placar exato"
                : guess.guess.score.winnerHit
                  ? "Vencedor correto"
                  : "Sem pontuacao"}
            </p>
          ) : null}
          <p className="flex items-center gap-2 text-xs text-app-muted sm:justify-end">
            <CalendarClock aria-hidden className="h-4 w-4 text-brand-gold" />
            {formatGuessDate(guess.kickoff)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
