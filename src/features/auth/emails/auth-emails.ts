type AuthEmailInput = {
  appUrl: string;
  userName?: string | null;
};

type GuessReminderLeague = {
  championshipName: string;
  name: string;
  nextKickoff: string | null;
  pendingMatches: number;
};

type GuessReminderEmailInput = AuthEmailInput & {
  leagues: GuessReminderLeague[];
};

type PasswordResetEmailInput = AuthEmailInput & {
  expiresInMinutes: number;
  resetUrl: string;
};

const EMAIL_LOGO_PATH = "/brand/bolao-do-lobo-email.png";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getGreeting(userName?: string | null) {
  return userName?.trim() ? `Ola, ${escapeHtml(userName.trim())}!` : "Ola!";
}

function getPlural(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function createEmailLayout(title: string, content: string, appUrl: string) {
  const logoUrl = `${appUrl.replace(/\/$/, "")}${EMAIL_LOGO_PATH}`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#061342;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#061342;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid rgba(255,193,7,.35);border-radius:18px;background:#0b1c5f;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;">
                <img src="${escapeHtml(logoUrl)}" width="96" height="96" alt="Bolao do Lobo" style="display:block;width:96px;height:96px;border-radius:999px;border:2px solid rgba(245,158,11,.8);margin:0 0 16px;object-fit:cover;" />
                <p style="margin:0 0 8px;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Bolao do Lobo</p>
                <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.15;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;color:#dbeafe;font-size:15px;line-height:1.6;">
                ${content}
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#93a4c7;font-size:12px;">Este e-mail foi enviado automaticamente pelo Bolao do Lobo.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createButton(label: string, href: string) {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(
    href
  )}" style="display:inline-block;border-radius:12px;background:#f59e0b;color:#061342;font-weight:700;text-decoration:none;padding:13px 18px;">${escapeHtml(
    label
  )}</a></p>`;
}

export function buildGuessReminderEmail({ appUrl, leagues, userName }: GuessReminderEmailInput) {
  const subject = "Voce tem palpites pendentes no Bolao do Lobo";
  const greeting = getGreeting(userName);
  const totalPendingMatches = leagues.reduce((sum, league) => sum + league.pendingMatches, 0);
  const leagueItemsHtml = leagues
    .map(
      (league) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(219,234,254,.14);">
          <strong style="display:block;color:#ffffff;font-size:15px;">${escapeHtml(league.name)}</strong>
          <span style="display:block;color:#b6c4e2;font-size:13px;">${escapeHtml(league.championshipName)}</span>
          <span style="display:block;margin-top:4px;color:#f59e0b;font-size:13px;font-weight:700;">${league.pendingMatches} ${getPlural(
            league.pendingMatches,
            "partida sem palpite",
            "partidas sem palpite"
          )}</span>
          ${
            league.nextKickoff
              ? `<span style="display:block;margin-top:4px;color:#b6c4e2;font-size:12px;">Proxima partida: ${escapeHtml(league.nextKickoff)}</span>`
              : ""
          }
        </td>
      </tr>`
    )
    .join("");
  const html = createEmailLayout(
    subject,
    `<p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">Voce tem ${totalPendingMatches} ${getPlural(
      totalPendingMatches,
      "palpite pendente",
      "palpites pendentes"
    )} em ligas que ja estao com rodadas abertas.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 4px;">
      ${leagueItemsHtml}
    </table>
    ${createButton("Fazer meus palpites", `${appUrl.replace(/\/$/, "")}/palpites`)}`,
    appUrl
  );

  return {
    html,
    subject,
    text: `${greeting}\n\nVoce tem ${totalPendingMatches} ${getPlural(
      totalPendingMatches,
      "palpite pendente",
      "palpites pendentes"
    )} no Bolao do Lobo.\n\n${leagues
      .map((league) => {
        const nextKickoff = league.nextKickoff ? ` Proxima partida: ${league.nextKickoff}.` : "";

        return `- ${league.name} (${league.championshipName}): ${league.pendingMatches} ${getPlural(
          league.pendingMatches,
          "partida sem palpite",
          "partidas sem palpite"
        )}.${nextKickoff}`;
      })
      .join("\n")}\n\nFazer palpites: ${appUrl.replace(/\/$/, "")}/palpites`
  };
}

export function buildWelcomeEmail({ appUrl, userName }: AuthEmailInput) {
  const subject = "Bem-vindo ao Bolao do Lobo";
  const greeting = getGreeting(userName);
  const html = createEmailLayout(
    subject,
    `<p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">Sua conta esta pronta para acompanhar ligas, palpites, ranking e recompensas do Bolao do Lobo.</p>
    <p style="margin:0;">Entre no app para conferir suas ligas e continuar sua jornada.</p>
    ${createButton("Abrir Bolao do Lobo", appUrl)}`,
    appUrl
  );

  return {
    html,
    subject,
    text: `${greeting}\n\nSua conta esta pronta para acompanhar ligas, palpites, ranking e recompensas do Bolao do Lobo.\n\nAcesse: ${appUrl}`
  };
}

export function buildPasswordResetEmail({
  appUrl,
  expiresInMinutes,
  resetUrl,
  userName
}: PasswordResetEmailInput) {
  const subject = "Redefinicao de senha do Bolao do Lobo";
  const greeting = getGreeting(userName);
  const html = createEmailLayout(
    subject,
    `<p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">Recebemos uma solicitacao para redefinir a senha da sua conta.</p>
    <p style="margin:0;">O link abaixo expira em ${expiresInMinutes} minutos.</p>
    ${createButton("Redefinir senha", resetUrl)}
    <p style="margin:0 0 12px;color:#b6c4e2;">Se voce nao solicitou isso, ignore este e-mail.</p>
    <p style="margin:0;color:#b6c4e2;">App: ${escapeHtml(appUrl)}</p>`,
    appUrl
  );

  return {
    html,
    subject,
    text: `${greeting}\n\nRecebemos uma solicitacao para redefinir a senha da sua conta.\nO link expira em ${expiresInMinutes} minutos.\n\nRedefinir senha: ${resetUrl}\n\nSe voce nao solicitou isso, ignore este e-mail.\nApp: ${appUrl}`
  };
}

export function buildIntegrationAnnouncementEmail({ appUrl, userName }: AuthEmailInput) {
  const subject = "Novidade no Bolao do Lobo: e-mails ativados";
  const greeting = getGreeting(userName);
  const html = createEmailLayout(
    subject,
    `<p style="margin:0 0 14px;">${greeting}</p>
    <p style="margin:0 0 14px;">A central de e-mails do Bolao do Lobo esta ativa. Agora voce podera receber comunicados importantes e recuperar sua senha com mais seguranca.</p>
    <p style="margin:0;">Nenhuma acao e necessaria agora. Quando precisar, use a opcao "Esqueci minha senha" na tela de login.</p>
    ${createButton("Acessar o app", appUrl)}`,
    appUrl
  );

  return {
    html,
    subject,
    text: `${greeting}\n\nA central de e-mails do Bolao do Lobo esta ativa. Agora voce podera receber comunicados importantes e recuperar sua senha com mais seguranca.\n\nAcesse: ${appUrl}`
  };
}
