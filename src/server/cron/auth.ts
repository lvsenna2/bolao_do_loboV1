import { createRemoteJWKSet, jwtVerify } from "jose";

const githubIssuer = "https://token.actions.githubusercontent.com";
const githubKeys = createRemoteJWKSet(new URL(`${githubIssuer}/.well-known/jwks`), {
  timeoutDuration: 5000
});
const cronAudience = "https://www.simuladorcopa2026.com.br/api/cron";
const repository = "lvsenna2/bolao_do_loboV1";

export function isValidCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function isValidScheduledCronRequest(request: Request): Promise<boolean> {
  if (isValidCronRequest(request)) return true;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice(7);
  if (token.length > 16384 || token.split(".").length !== 3) return false;

  try {
    const { payload } = await jwtVerify(token, githubKeys, {
      algorithms: ["RS256"],
      issuer: githubIssuer,
      audience: cronAudience,
      subject: `repo:${repository}:ref:refs/heads/main`,
      requiredClaims: ["exp", "iat", "nbf"],
      maxTokenAge: "10m",
      clockTolerance: 5
    });

    return (
      payload.repository === repository &&
      payload.repository_id === "1287563515" &&
      payload.repository_owner_id === "206237160" &&
      payload.ref === "refs/heads/main" &&
      payload.workflow_ref ===
        `${repository}/.github/workflows/football-cron.yml@refs/heads/main` &&
      payload.runner_environment === "github-hosted" &&
      (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch")
    );
  } catch {
    return false;
  }
}
