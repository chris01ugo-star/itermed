/**
 * npx tsx --test lib/billing/short-session.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pingReleaseShortSession } from "@/lib/billing/release-short-session-client";
import { isSessionTooShort, MIN_BILLABLE_SESSION_MS } from "@/lib/billing/short-session";

describe("isSessionTooShort", () => {
  it("does not count a session under 30 seconds as used", () => {
    const createdAt = new Date("2026-11-24T17:00:00.000Z");
    assert.equal(
      isSessionTooShort(createdAt, new Date("2026-11-24T17:00:29.999Z")),
      true,
    );
  });

  it("counts a session at exactly 30 seconds as used", () => {
    const createdAt = new Date("2026-11-24T17:00:00.000Z");
    assert.equal(
      isSessionTooShort(createdAt, new Date(createdAt.getTime() + MIN_BILLABLE_SESSION_MS)),
      false,
    );
  });

  it("counts a session longer than 30 seconds as used", () => {
    const createdAt = new Date("2026-11-24T17:00:00.000Z");
    assert.equal(
      isSessionTooShort(createdAt, new Date("2026-11-24T17:00:31.000Z")),
      false,
    );
  });
});

describe("pingReleaseShortSession", () => {
  it("does not ping offline registry tokens", () => {
    const original = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    try {
      pingReleaseShortSession("registry_offline");
      pingReleaseShortSession(undefined);
      assert.equal(called, 0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("posts a live session id with keepalive", async () => {
    const original = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ released: true }), { status: 200 });
    }) as typeof fetch;
    try {
      pingReleaseShortSession("clxxxxxxxxxxxxxxxxxxxx");
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "/api/session/release-short");
      assert.equal(calls[0]?.init?.method, "POST");
      assert.equal(calls[0]?.init?.keepalive, true);
      assert.equal(calls[0]?.init?.body, JSON.stringify({ sessionId: "clxxxxxxxxxxxxxxxxxxxx" }));
    } finally {
      globalThis.fetch = original;
    }
  });
});
