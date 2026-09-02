import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { buildUpstreamHeaders, decryptCredential, encryptCredential, parseCompletedResponse, retryAfterDeadline, validateResponsePayload } from "./proxy.ts";
import { OAuthRefreshError, refreshOAuthTokens } from "../refresh-proxy-usage/oauth.ts";

const UPSTREAM_URL = "https://chatgpt.com/backend-api/codex/responses";
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

type HostedProxyAccount = {
  legacy_account_id: string;
  chatgpt_account_id: string | null;
  codex_installation_id: string;
};

type HostedProxyCredential = {
  access_token_ciphertext: string;
};

type RefreshCredentials = {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  id_token_ciphertext: string;
};

const json = (status: number, payload: Record<string, unknown>) => Response.json(payload, {
  status,
  headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
});

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function serviceRoleKey(): string | null {
  const legacy = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const encoded = requiredEnv("SUPABASE_SECRET_KEYS");
  if (!encoded) return null;
  try {
    const keys = JSON.parse(encoded) as Record<string, unknown>;
    return typeof keys.default === "string" && keys.default ? keys.default : null;
  } catch {
    return null;
  }
}

function publishableKey(): string | null {
  const legacy = requiredEnv("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  const encoded = requiredEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (!encoded) return null;
  try {
    const keys = JSON.parse(encoded) as Record<string, unknown>;
    return typeof keys.default === "string" && keys.default ? keys.default : null;
  } catch {
    return null;
  }
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");
  for (const [name, value] of upstream.headers.entries()) {
    if (name.toLowerCase().startsWith("x-ratelimit-")) headers.set(name, value);
  }
  return headers;
}

async function resolveOwnerId(request: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" } });
    }
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json(413, { error: "request_too_large" });

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = publishableKey();
    const adminKey = serviceRoleKey();
    const credentialKey = requiredEnv("HOSTED_PROXY_CREDENTIAL_KEY");
    if (!supabaseUrl || !anonKey || !adminKey || !credentialKey) return json(503, { error: "proxy_not_configured" });

    const ownerId = await resolveOwnerId(request, supabaseUrl, anonKey);
    if (!ownerId) return json(401, { error: "unauthorized" });

    let payload: unknown;
    try {
      const rawBody = await request.arrayBuffer();
      if (rawBody.byteLength > MAX_REQUEST_BYTES) return json(413, { error: "request_too_large" });
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (!validateResponsePayload(payload)) return json(400, { error: "invalid_responses_payload" });

    const admin = createClient(supabaseUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: recoveryError } = await admin.rpc("hosted_proxy_recover_expired_rate_limits", { requested_owner_id: ownerId });
    if (recoveryError) return json(503, { error: "proxy_storage_unavailable" });
    const { data: accounts, error: accountError } = await admin
      .rpc("hosted_proxy_select_account", { requested_owner_id: ownerId });
    const account = Array.isArray(accounts) ? accounts[0] as HostedProxyAccount | undefined : undefined;
    if (accountError) return json(503, { error: "proxy_storage_unavailable" });
    if (!account) return json(409, { error: "no_active_proxy_account" });

    const { data: credentialsRows, error: credentialsError } = await admin
      .rpc("hosted_proxy_credentials_for_account", {
        requested_owner_id: ownerId,
        requested_legacy_account_id: account.legacy_account_id,
      });
    const credentials = Array.isArray(credentialsRows) ? credentialsRows[0] as HostedProxyCredential | undefined : undefined;
    if (credentialsError) return json(503, { error: "proxy_storage_unavailable" });
    if (!credentials) return json(409, { error: "proxy_credentials_unavailable" });

    let accessToken: string;
    try {
      accessToken = await decryptCredential(credentials.access_token_ciphertext, credentialKey);
    } catch {
      return json(503, { error: "proxy_credentials_unavailable" });
    }

    const upstreamHeaders = buildUpstreamHeaders(request.headers, accessToken, account.chatgpt_account_id);
    upstreamHeaders["x-codex-installation-id"] = account.codex_installation_id;
    let upstream: Response;
    try {
      upstream = await fetch(UPSTREAM_URL, { method: "POST", headers: upstreamHeaders, body: JSON.stringify(payload) });
    } catch {
      return json(502, { error: "upstream_unavailable" });
    }

    if (upstream.status === 401) {
      const rotatedAccessToken = await rotateOAuthTokens(admin, ownerId, account.legacy_account_id, credentialKey);
      if (rotatedAccessToken) {
        const retriedHeaders = buildUpstreamHeaders(request.headers, rotatedAccessToken, account.chatgpt_account_id);
        retriedHeaders["x-codex-installation-id"] = account.codex_installation_id;
        try {
          upstream = await fetch(UPSTREAM_URL, { method: "POST", headers: retriedHeaders, body: JSON.stringify(payload) });
        } catch {
          return json(502, { error: "upstream_unavailable" });
        }
      }
    }

    if (upstream.status === 429) {
      await admin.rpc("hosted_proxy_mark_rate_limited", {
        requested_owner_id: ownerId,
        requested_legacy_account_id: account.legacy_account_id,
        requested_reset_at: retryAfterDeadline(upstream.headers.get("retry-after")),
      });
    }

    if (payload.stream === true) return new Response(upstream.body, { status: upstream.status, headers: responseHeaders(upstream) });
    if (!upstream.ok) return new Response(upstream.body, { status: upstream.status, headers: responseHeaders(upstream) });
    const completed = parseCompletedResponse(await upstream.text());
    if (completed === null) return json(502, { error: "upstream_protocol_error" });
    return new Response(JSON.stringify(completed), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } });
  },
};

async function rotateOAuthTokens(admin: ReturnType<typeof createClient>, ownerId: string, legacyAccountId: string, credentialKey: string): Promise<string | null> {
  const { data, error } = await admin.rpc("hosted_proxy_credentials_for_refresh", { requested_owner_id: ownerId, requested_legacy_account_id: legacyAccountId });
  const credentials = Array.isArray(data) ? data[0] as RefreshCredentials | undefined : undefined;
  if (error || !credentials) return null;
  const { data: claimRows, error: claimError } = await admin.rpc("hosted_proxy_claim_refresh", {
    requested_owner_id: ownerId, requested_legacy_account_id: legacyAccountId, expected_refresh_token_ciphertext: credentials.refresh_token_ciphertext,
  });
  if (claimError || claimRows !== true) return null;
  let rotated = false;
  try {
    const next = await refreshOAuthTokens(await decryptCredential(credentials.refresh_token_ciphertext, credentialKey));
    const { data: didRotate, error: rotateError } = await admin.rpc("hosted_proxy_rotate_credentials", {
      requested_owner_id: ownerId, requested_legacy_account_id: legacyAccountId, expected_refresh_token_ciphertext: credentials.refresh_token_ciphertext,
      next_access_token_ciphertext: await encryptCredential(next.accessToken, credentialKey),
      next_refresh_token_ciphertext: await encryptCredential(next.refreshToken, credentialKey),
      next_id_token_ciphertext: await encryptCredential(next.idToken, credentialKey),
    });
    rotated = didRotate === true && !rotateError;
    return rotated ? next.accessToken : null;
  } catch (error) {
    if (error instanceof OAuthRefreshError && error.permanent) {
      await admin.rpc("hosted_proxy_mark_reauth_required", { requested_owner_id: ownerId, requested_legacy_account_id: legacyAccountId });
    }
    return null;
  } finally {
    if (!rotated) await admin.rpc("hosted_proxy_release_refresh_claim", {
      requested_owner_id: ownerId, requested_legacy_account_id: legacyAccountId, expected_refresh_token_ciphertext: credentials.refresh_token_ciphertext,
    });
  }
}
