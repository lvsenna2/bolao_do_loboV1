import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("football sync cron route", () => {
  it.each([
    ["GET", GET],
    ["POST", POST]
  ])("keeps %s disabled without starting an automation", async (_method, handler) => {
    const response = await handler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      disabled: true,
      message:
        "A sincronizacao automatica esta desativada. Use a sincronizacao manual no painel administrativo.",
      ok: true
    });
  });
});
