import { expect, test } from "bun:test";

import {
  HostedResponsesSseDecoder,
  parseHostedWebSocketControl,
  parseHostedResponseCreate,
} from "../../api/_lib/hosted-websocket.ts";

test("accepts one bounded response.create frame and converts it to an SSE request payload", () => {
  expect(
    parseHostedResponseCreate(
      JSON.stringify({
        type: "response.create",
        model: "gpt-5.4",
        input: "hello",
        stream: true,
      }),
    ),
  ).toEqual({
    ok: true,
    payload: {
      model: "gpt-5.4",
      input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }],
      stream: true,
      store: false,
    },
  });
});

test("preserves legacy WebSocket create frames that omit stream by requesting SSE from the hosted relay", () => {
  expect(
    parseHostedResponseCreate(
      JSON.stringify({
        type: "response.create",
        model: "gpt-5.4",
        input: "legacy default stream",
      }),
    ),
  ).toEqual({
    ok: true,
    payload: {
      model: "gpt-5.4",
      input: [{ role: "user", content: [{ type: "input_text", text: "legacy default stream" }] }],
      stream: true,
      store: false,
    },
  });
});

test("preserves structured input while enforcing the upstream's no-store contract", () => {
  const input = [{ role: "user", content: [{ type: "input_text", text: "already structured" }] }];

  expect(parseHostedResponseCreate(JSON.stringify({
    type: "response.create",
    model: "gpt-5.4",
    input,
    stream: true,
    store: true,
  }))).toEqual({
    ok: true,
    payload: { model: "gpt-5.4", input, stream: true, store: false },
  });
});

test("accepts only bounded cancel and owner-scoped replay control frames", () => {
  expect(parseHostedWebSocketControl(JSON.stringify({ type: "response.cancel" }))).toEqual({ type: "cancel" });
  expect(parseHostedWebSocketControl(JSON.stringify({
    type: "response.replay",
    spool_id: "00000000-0000-4000-8000-000000000001",
    after_cursor: 4,
  }))).toEqual({ type: "replay", spoolId: "00000000-0000-4000-8000-000000000001", afterCursor: 4 });
  expect(parseHostedWebSocketControl(JSON.stringify({ type: "response.replay", spool_id: "not-a-uuid", after_cursor: -1 }))).toBeNull();
});

test("rejects malformed frames but preserves the legacy no-op behavior for non-create frames", () => {
  expect(parseHostedResponseCreate("not json")).toEqual({
    ok: false,
    error: "invalid_client_frame",
  });
  expect(parseHostedResponseCreate(JSON.stringify({ type: "response.cancel", response_id: "resp_1" }))).toEqual({
    ok: false,
    error: "ignored_client_frame",
  });
  expect(parseHostedResponseCreate(JSON.stringify({ type: "response.create", model: "gpt-5.4" }))).toEqual({
    ok: false,
    error: "invalid_client_frame",
  });
  expect(parseHostedResponseCreate(JSON.stringify({ type: "response.create", model: "gpt-5.4", input: {} }))).toEqual({
    ok: false,
    error: "invalid_client_frame",
  });
});

test("emits complete JSON frames only after a fragmented SSE record is complete", () => {
  const decoder = new HostedResponsesSseDecoder();

  expect(decoder.push("event: response.created\r\ndata: {\"type\":\"response.cr")).toEqual([]);
  expect(decoder.push("eated\",\"response\":{\"id\":\"resp_1\"}}\r\n\r\n")).toEqual([
    '{"type":"response.created","response":{"id":"resp_1"}}',
  ]);
});

test("ignores SSE keepalives and done sentinels while retaining terminal Responses events", () => {
  const decoder = new HostedResponsesSseDecoder();

  expect(
    decoder.push(
      ": keepalive\n\ndata: [DONE]\n\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\"}}\n\n",
    ),
  ).toEqual(['{"type":"response.completed","response":{"id":"resp_1"}}']);
});
