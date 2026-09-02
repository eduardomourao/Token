import httpResponsesHandler from "./responses";
import { handleHostedWebSocketUpgrade } from "../hosted-ws-probe";

type HeaderValue = string | string[] | undefined;
type NativeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};
type NativeResponse = {
  status(code: number): NativeResponse;
  setHeader(name: string, value: string): void;
  json(payload: Record<string, unknown>): void;
  write(chunk: Uint8Array): void;
  end(): void;
};

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
};

export function shouldUpgradeHostedResponses(request: Pick<NativeRequest, "method" | "headers">): boolean {
  const upgrade = request.headers.upgrade ?? request.headers.Upgrade;
  return request.method === "GET" && typeof upgrade === "string" && upgrade.toLowerCase() === "websocket";
}

/**
 * Keeps the deployed HTTP Responses relay byte-for-byte on its existing path,
 * adding the hosted gateway only for an actual WebSocket upgrade.
 */
export default async function handler(request: NativeRequest, response: NativeResponse): Promise<void> {
  if (shouldUpgradeHostedResponses(request)) {
    await handleHostedWebSocketUpgrade(request, response);
    return;
  }
  await httpResponsesHandler(request, response);
}
