import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PublicPromoRoundView } from "@/features/special-rounds/components/public-promo-round-view";
import { getPublicPromoRoundBySlug } from "@/features/special-rounds/data/public-promo-data";
import { getCurrentSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type PromoPageSearchParams = Record<string, string | string[] | undefined>;

function buildCallbackUrl(roundId: string, values: PromoPageSearchParams) {
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(values)) {
    const isTrackingParameter =
      key.toLowerCase().startsWith("utm_") || ["fbclid", "gclid"].includes(key.toLowerCase());
    if (!isTrackingParameter) continue;

    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      if (value) query.append(key, value);
    }
  }

  const base = `/rodadas-especiais/${roundId}`;
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

export default async function PublicPromoPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PromoPageSearchParams>;
}) {
  const [{ slug }, tracking, session] = await Promise.all([
    params,
    searchParams,
    getCurrentSession()
  ]);
  const round = await getPublicPromoRoundBySlug(slug);

  if (!round) notFound();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050505] bg-[radial-gradient(circle_at_top_left,rgba(242,185,28,0.16),transparent_34%),linear-gradient(180deg,#17130a_0%,#090909_42%,#020202_100%)] text-white">
      <SiteHeader authenticated={Boolean(session?.user)} />
      <main className="relative min-w-0 flex-1 overflow-x-hidden">
        <PublicPromoRoundView
          callbackUrl={buildCallbackUrl(round.id, tracking)}
          isAuthenticated={Boolean(session?.user)}
          round={round}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
