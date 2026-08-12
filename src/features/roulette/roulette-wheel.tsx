"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";

import { LoadingButton } from "@/components/ui/loading-button";
import { spinRouletteAction } from "./roulette-actions";

export function RouletteWheel({
  bonusAvailable,
  dailyAvailable
}: {
  bonusAvailable: boolean;
  dailyAvailable: boolean;
}) {
  const [bonus, setBonus] = useState(bonusAvailable);
  const [daily, setDaily] = useState(dailyAvailable);
  const [loading, setLoading] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ jackpot: boolean; prizeName: string }>();
  const available = daily || bonus;

  async function spin() {
    if (!available || loading) return;
    setLoading(true);
    setResult(undefined);
    const kind = daily ? "DAILY" : "BONUS";
    const response = await spinRouletteAction(kind);
    setRotation((value) => value + 1_440 + Math.floor(Math.random() * 300));
    window.setTimeout(() => {
      if (response.ok) {
        setResult(response.data);
        if (kind === "DAILY") setDaily(false);
        else setBonus(false);
        if (response.data.prizeId === "bonus_spin") setBonus(true);
      }
      setLoading(false);
    }, 1_500);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-64 w-64">
        <span
          aria-hidden
          className="absolute left-1/2 top-[-8px] z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-brand-gold"
        />
        <div
          aria-label="Roleta de premios"
          className="grid h-full w-full place-items-center rounded-full border-8 border-brand-gold shadow-[0_0_40px_rgba(242,185,28,0.25)] transition-transform duration-[1500ms] ease-out"
          style={{
            background:
              "conic-gradient(#f2b91c 0 18deg,#161616 18deg 90deg,#7c5b08 90deg 180deg,#202020 180deg 270deg,#b8860b 270deg 360deg)",
            transform: `rotate(${rotation}deg)`
          }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-brand-gold bg-black text-center text-sm font-bold text-brand-gold">
            LOBO
            <br />
            DA SORTE
          </div>
        </div>
      </div>
      <p className="text-center text-sm text-app-muted">
        {available
          ? `${daily ? "1 giro diario" : "1 giro bonus"} disponivel.`
          : "Volte amanha para girar novamente."}
      </p>
      <LoadingButton
        className="h-12 rounded-button bg-brand-gold px-8 font-bold text-black"
        disabled={!available}
        isLoading={loading}
        loadingLabel="Girando..."
        onClick={spin}
        icon={<RotateCw className="h-4 w-4" />}
      >
        GIRAR ROLETA
      </LoadingButton>
      {result ? (
        <div
          className={`w-full rounded-card border p-4 text-center font-semibold ${result.jackpot ? "border-brand-gold bg-brand-gold/20 text-brand-gold" : "border-app-border bg-app-background text-app-foreground"}`}
        >
          {result.jackpot ? "JACKPOT! " : ""}
          {result.prizeName}
        </div>
      ) : null}
    </div>
  );
}
