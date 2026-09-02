export const HOSTED_WEBSOCKET_MAX_FRAME_BYTES = 256 * 1024;

type HostedResponseCreateResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: "invalid_client_frame" | "ignored_client_frame" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseHostedResponseCreate(frame: string): HostedResponseCreateResult {
  if (Buffer.byteLength(frame, "utf8") > HOSTED_WEBSOCKET_MAX_FRAME_BYTES) {
    return { ok: false, error: "invalid_client_frame" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(frame);
  } catch {
    return { ok: false, error: "invalid_client_frame" };
  }

  if (!isRecord(parsed)) return { ok: false, error: "invalid_client_frame" };
  if (parsed.type !== "response.create") return { ok: false, error: "ignored_client_frame" };
  if (typeof parsed.model !== "string" || parsed.model.length === 0 || !("input" in parsed)) {
    return { ok: false, error: "invalid_client_frame" };
  }
  if (parsed.stream === false || (parsed.stream !== undefined && parsed.stream !== true)) {
    return { ok: false, error: "invalid_client_frame" };
  }

  const { type: _type, ...payload } = parsed;
  return { ok: true, payload: { ...payload, stream: true } };
}

export class HostedResponsesSseDecoder {
  private buffered = "";

  push(chunk: string): string[] {
    this.buffered += chunk;
    const frames: string[] = [];

    while (true) {
      const separator = /\r?\n\r?\n/.exec(this.buffered);
      if (!separator || separator.index === undefined) return frames;

      const record = this.buffered.slice(0, separator.index);
      this.buffered = this.buffered.slice(separator.index + separator[0].length);
      const data = record
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");

      if (!data || data === "[DONE]") continue;
      try {
        const payload: unknown = JSON.parse(data);
        if (isRecord(payload)) frames.push(JSON.stringify(payload));
      } catch {
        // An upstream record that is not a JSON Responses event is not a
        // downstream WebSocket frame. The relay will emit a safe terminal
        // result when the stream itself fails.
      }
    }
  }
}
