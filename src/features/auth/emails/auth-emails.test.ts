import { describe, expect, it } from "vitest";

import {
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
});
