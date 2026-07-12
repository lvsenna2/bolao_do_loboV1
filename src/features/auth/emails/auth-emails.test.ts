import { describe, expect, it } from "vitest";

import {
  buildGuessReminderEmail,
  buildIntegrationAnnouncementEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail
} from "./auth-emails";

describe("auth email templates", () => {
  it("includes the reset URL and expiration in the password reset email", () => {
    const email = buildPasswordResetEmail({
      appUrl: "https://app.example.com",
      expiresInMinutes: 30,
      resetUrl: "https://app.example.com/reset-password?token=abc",
      userName: "Lucas"
    });

    expect(email.subject).toContain("Redefinicao");
    expect(email.html).toContain("https://app.example.com/reset-password?token=abc");
    expect(email.html).toContain("https://app.example.com/brand/bolao-do-lobo-email.png");
    expect(email.text).toContain("30 minutos");
  });

  it("builds welcome and announcement emails with the app URL", () => {
    const welcome = buildWelcomeEmail({
      appUrl: "https://app.example.com",
      userName: "Lucas"
    });
    const announcement = buildIntegrationAnnouncementEmail({
      appUrl: "https://app.example.com",
      userName: "Lucas"
    });

    expect(welcome.text).toContain("https://app.example.com");
    expect(announcement.text).toContain("recuperar sua senha");
  });

  it("builds guess reminder emails with pending leagues", () => {
    const email = buildGuessReminderEmail({
      appUrl: "https://app.example.com/",
      leagues: [
        {
          championshipName: "Brasileirao",
          name: "Liga do Brasileirao",
          nextKickoff: "12/07/2026 as 20:00",
          pendingMatches: 3
        }
      ],
      userName: "Lucas"
    });

    expect(email.subject).toContain("palpites pendentes");
    expect(email.html).toContain("Liga do Brasileirao");
    expect(email.html).toContain("https://app.example.com/palpites");
    expect(email.text).toContain("3 partidas sem palpite");
  });
});
