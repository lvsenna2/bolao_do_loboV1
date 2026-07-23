import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json({
    disabled: true,
    message:
      "A sincronizacao automatica esta desativada. Use a sincronizacao manual no painel administrativo.",
    ok: true
  });
}

// Mantemos a rota como resposta neutra enquanto o agendamento externo e removido.
// Assim, entregas antigas nao iniciam a API-Football nem geram erros 404 na Vercel.
export const GET = disabledResponse;
export const POST = disabledResponse;
