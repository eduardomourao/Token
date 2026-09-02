import { expect, test } from "bun:test";

import {
  HostedResponsesSseDecoder,
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
      input: "hello",
      stream: true,
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
      input: "legacy default stream",
      stream: true,
    },
  });
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
