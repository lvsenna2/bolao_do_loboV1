import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "bolao-do-lobo",
      timestamp: new Date().toISOString()
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "bolao-do-lobo",
        timestamp: new Date().toISOString()
      },
      {
        status: 503
      }
    );
  }
}
