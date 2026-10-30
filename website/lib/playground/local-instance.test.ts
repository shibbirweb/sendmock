import { afterEach, describe, expect, test } from "bun:test";

import {
  connectToInstance,
  describeConnectionProblem,
  sendToInstance,
} from "./local-instance";

const originalFetch = globalThis.fetch;

/** Replaces fetch with one that answers or fails per URL and records every call. */
function fakeFetch(
  answer: (url: string, init?: RequestInit) => Promise<Response>,
): string[] {
  const calledUrls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calledUrls.push(url);
    return answer(url, init);
  }) as typeof fetch;
  return calledUrls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("local instance", () => {
  test("WS-05.1 connects to the URL given and sends requests there with the token", async () => {
    const calledUrls = fakeFetch(async (url, init) =>
      url.endsWith("/api/v1/info")
        ? Response.json({ version: "0.1.0" })
        : Response.json(
            { authorization: new Headers(init?.headers).get("authorization") },
            { status: 201 },
          ),
    );

    const outcome = await connectToInstance(
      "http://localhost:9025/",
      "tok_123",
    );
    const response = await sendToInstance("http://localhost:9025", "tok_123", {
      method: "POST",
      path: "/api/v1/send",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(outcome).toEqual({ kind: "connected", version: "0.1.0" });
    expect(calledUrls).toEqual([
      "http://localhost:9025/api/v1/info",
      "http://localhost:9025/api/v1/send",
    ]);
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      authorization: "Bearer tok_123",
    });
  });

  test("WS-05.3 tells a server that refuses this site from one that is not there", async () => {
    fakeFetch(async (_url, init) => {
      if (init?.mode === "no-cors") {
        return new Response(null, { status: 200 });
      }
      throw new TypeError("Failed to fetch");
    });
    const refusingOutcome = await connectToInstance(
      "http://localhost:8025",
      null,
    );
    fakeFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const missingOutcome = await connectToInstance(
      "http://localhost:8025",
      null,
    );

    expect(refusingOutcome).toEqual({ kind: "failed", problem: "cors" });
    expect(missingOutcome).toEqual({ kind: "failed", problem: "unreachable" });
    expect(
      describeConnectionProblem("unreachable", "http://localhost:8025"),
    ).toContain("local network");
    expect(
      describeConnectionProblem("cors", "http://localhost:8025"),
    ).toContain("--cors-origins");
  });

  test("WS-05.3 a server with UI auth asks for the token", async () => {
    fakeFetch(async () => new Response(null, { status: 401 }));

    expect(await connectToInstance("http://localhost:8025", null)).toEqual({
      kind: "failed",
      problem: "unauthorized",
    });
  });
});
