import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("./request", () => ({
  apiFootballRequest: requestMock,
  isFootballApiConfigured: vi.fn(() => true)
}));

import { fetchApiFootballTeamSquad } from "./client";

describe("API-Football client", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("normalizes a team squad for the special-round scorer market", async () => {
    requestMock.mockResolvedValue({
      callsUsed: 1,
      data: [
        {
          players: [
            {
              id: 12701,
              name: "Atacante Teste",
              photo: "https://media.api-sports.io/football/players/12701.png",
              position: "Attacker"
            }
          ],
          team: {
            code: "FLA",
            country: "Brazil",
            id: 127,
            logo: "https://media.api-sports.io/football/teams/127.png",
            name: "Flamengo"
          }
        }
      ],
      durationMs: 80,
      ok: true,
      rateLimit: {
        dailyLimit: 7500,
        dailyRemaining: 7499,
        minuteLimit: 300,
        minuteRemaining: 299
      },
      statusCode: 200
    });

    const result = await fetchApiFootballTeamSquad(127);

    expect(requestMock).toHaveBeenCalledWith(
      "players/squads",
      new URLSearchParams({ team: "127" }),
      { priority: "NORMAL", retries: 0 }
    );
    expect(result).toMatchObject({
      data: [
        {
          players: [
            {
              apiId: 12701,
              name: "Atacante Teste",
              photo: "https://media.api-sports.io/football/players/12701.png",
              position: "Attacker"
            }
          ],
          team: { apiId: 127, name: "Flamengo", shortName: "FLA" }
        }
      ],
      ok: true
    });
  });
});
