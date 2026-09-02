const OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OAUTH_SCOPE = "openid profile email";

export class OAuthRefreshError extends Error {
  constructor(readonly permanent: boolean) { super("OAuth token refresh failed"); }
}

export type OAuthTokens = { accessToken: string; refreshToken: string; idToken: string };

export async function refreshOAuthTokens(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: OAUTH_CLIENT_ID, refresh_token: refreshToken, scope: OAUTH_SCOPE }),
  });
  const payload = await safeJson(response);
  if (!response.ok) throw new OAuthRefreshError(isPermanentRefreshError(payload));
  const accessToken = stringField(payload, "access_token");
  const nextRefreshToken = stringField(payload, "refresh_token");
  const idToken = stringField(payload, "id_token");
  if (!accessToken || !nextRefreshToken || !idToken) throw new OAuthRefreshError(false);
  return { accessToken, refreshToken: nextRefreshToken, idToken };
}

function isPermanentRefreshError(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const error = typeof payload.error === "string" ? payload.error : isRecord(payload.error) && typeof payload.error.code === "string" ? payload.error.code : null;
  return error === "refresh_token_expired" || error === "refresh_token_reused" || error === "refresh_token_invalidated" || error === "invalid_grant" || error === "token_invalidated" || error === "token_expired" || error === "app_session_terminated";
}

async function safeJson(response: Response): Promise<unknown> { try { return await response.json(); } catch { return null; } }
function stringField(value: unknown, field: string): string | null { return isRecord(value) && typeof value[field] === "string" && value[field] ? value[field] : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
