import { NextResponse } from "next/server";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "bolao-do-lobo",
      timestamp: serverNow().toISOString()
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "bolao-do-lobo",
        timestamp: serverNow().toISOString()
      },
      {
        status: 503
      }
    );
  }
}
