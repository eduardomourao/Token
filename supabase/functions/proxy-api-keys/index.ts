import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { apiKeyHash } from "../proxy-responses/proxy.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "cache-control": "no-store",
};

const json = (status: number, payload: Record<string, unknown>) => Response.json(payload, { status, headers: corsHeaders });

type ManagedApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
};

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

function newApiKey(): string {
  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);
  return `sk-clb-${Array.from(entropy, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function resolveOwnerId(request: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

function listPayload(rows: ManagedApiKey[] | null): Record<string, unknown> {
  return { apiKeys: rows ?? [] };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = publishableKey();
    const adminKey = serviceRoleKey();
    if (!supabaseUrl || !anonKey || !adminKey) return json(503, { error: "api_key_service_not_configured" });

    const ownerId = await resolveOwnerId(request, supabaseUrl, anonKey);
    if (!ownerId) return json(401, { error: "unauthorized" });
    const admin = createClient(supabaseUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (request.method === "GET") {
      const { data, error } = await admin.rpc("hosted_proxy_list_api_keys", { requested_owner_id: ownerId });
      return error ? json(503, { error: "api_key_storage_unavailable" }) : json(200, listPayload(data as ManagedApiKey[] | null));
    }
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

    let body: { action?: unknown; name?: unknown; id?: unknown; expiresAt?: unknown };
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }

    if (body.action === "revoke" && typeof body.id === "string") {
      const { data, error } = await admin.rpc("hosted_proxy_revoke_api_key", { requested_owner_id: ownerId, requested_id: body.id });
      return error ? json(503, { error: "api_key_storage_unavailable" }) : json(data === true ? 200 : 404, data === true ? { revoked: true } : { error: "api_key_not_found" });
    }
    if (body.action !== "create" || typeof body.name !== "string") return json(400, { error: "invalid_api_key_request" });
    const name = body.name.trim();
    if (!name || name.length > 120) return json(400, { error: "invalid_api_key_name" });
    const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && (!Number.isFinite(expiresAt.valueOf()) || expiresAt <= new Date())) return json(400, { error: "invalid_api_key_expiry" });

    const key = newApiKey();
    const keyHash = await apiKeyHash(key);
    if (!keyHash) return json(503, { error: "api_key_generation_failed" });
    const { data, error } = await admin.rpc("hosted_proxy_create_api_key", {
      requested_id: crypto.randomUUID(),
      requested_owner_id: ownerId,
      requested_name: name,
      requested_key_hash: keyHash,
      requested_key_prefix: key.slice(0, 15),
      requested_expires_at: expiresAt?.toISOString() ?? null,
    });
    const created = Array.isArray(data) ? data[0] as ManagedApiKey | undefined : undefined;
    return error || !created ? json(503, { error: "api_key_storage_unavailable" }) : json(201, { apiKey: created, key });
  },
};
