import type { SpecialRoundStatus } from "@prisma/client";
import { CalendarClock, Coins, Swords, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { SpecialRoundStatusBadge } from "./status-badge";

type Props = {
  awayTeamLogo: string | null;
  awayTeamName: string;
  entryFee: number;
  estimatedPrize: number;
  homeTeamLogo: string | null;
  homeTeamName: string;
  id: string;
  matchStartsAt: Date;
  name: string;
  participants: number;
  status: SpecialRoundStatus;
};

function Team({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        aria-label={`Escudo de ${name}`}
        className="h-14 w-14 rounded-full border border-brand-gold/25 bg-app-elevated bg-contain bg-center bg-no-repeat"
        role="img"
        style={logo ? { backgroundImage: `url("${logo}")` } : undefined}
      >
        {!logo ? name.slice(0, 2).toUpperCase() : null}
      </span>
      <strong className="line-clamp-2 text-sm">{name}</strong>
    </div>
  );
}

export function SpecialRoundCard(props: Props) {
  return (
    <Card className="overflow-hidden border-brand-gold/25">
      <CardHeader className="border-b border-app-border bg-black/10">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{props.name}</CardTitle>
          <SpecialRoundStatusBadge status={props.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex items-center gap-4">
          <Team logo={props.homeTeamLogo} name={props.homeTeamName} />
          <Swords aria-hidden className="h-6 w-6 shrink-0 text-brand-gold" />
          <Team logo={props.awayTeamLogo} name={props.awayTeamName} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <CalendarClock className="h-4 w-4 text-brand-gold" />
            <span>{formatDateTimeInSaoPaulo(props.matchStartsAt)}</span>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-brand-gold" />
            <span>{props.participants} pagos</span>
          </div>
          <div className="flex items-start gap-2">
            <Coins className="h-4 w-4 text-brand-gold" />
            <span>
              Entrada{" "}
              {props.entryFee.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}
            </span>
          </div>
          <div className="font-semibold text-brand-gold">
            Premio{" "}
            {props.estimatedPrize.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}
          </div>
        </dl>
        <Link
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-button bg-brand-gold px-4 font-semibold text-black transition hover:bg-amber-300"
          href={`/rodadas-especiais/${props.id}` as Route}
        >
          Ver rodada
        </Link>
      </CardContent>
    </Card>
  );
}
