import { NextResponse } from "next/server";

import { createPasskeyLoginOptions } from "@/server/auth/webauthn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const { challengeId, options } = await createPasskeyLoginOptions();

    return NextResponse.json(
      { challengeId, ok: true, options },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel iniciar o login por biometria.", ok: false },
      { status: 500 }
    );
  }
}
