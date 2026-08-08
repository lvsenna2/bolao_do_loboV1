import { prisma } from "@/server/db";
import {
  createFootballLogoResponse,
  footballLogoFallback
} from "@/server/football-api/logo-response";

export const runtime = "nodejs";

type ChampionshipLogoRouteContext = {
  params: Promise<{
    apiId: string;
  }>;
};

export async function GET(_request: Request, context: ChampionshipLogoRouteContext) {
  const { apiId: rawApiId } = await context.params;
  const apiId = Number(rawApiId);

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return footballLogoFallback("Liga", 400);
  }

  const championship = await prisma.championship.findFirst({
    select: {
      logo: true,
      name: true
    },
    where: {
      apiId,
      deletedAt: null
    }
  });

  return createFootballLogoResponse({
    apiId,
    fallbackLabel: championship?.name || `Liga ${apiId}`,
    kind: "leagues",
    storedLogo: championship?.logo
  });
}
