import Link from "next/link";
import { WalletCards } from "lucide-react";
import type { Route } from "next";

import { formatCents, getWalletBalance } from "@/features/wallet/services/wallet-service";

export async function WalletBalanceLink({ userId }: { userId: string }) {
  const wallet = await getWalletBalance(userId);
  return (
    <Link
      className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-button border border-brand-gold/30 bg-brand-gold/10 px-2 text-xs font-semibold text-brand-gold sm:gap-2 sm:px-3 sm:text-sm"
      href={"/carteira" as Route}
    >
      <WalletCards className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Saldo:</span> {formatCents(wallet.totalCents)}
    </Link>
  );
}
