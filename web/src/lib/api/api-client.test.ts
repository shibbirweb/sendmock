import { afterEach, describe, expect, test, vi } from "vitest";

import { ApiError, buildRealtimeUrl, requestApi } from "@/lib/api/api-client";

function stubFetchResponse(response: Response) {
  const fetchStub = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchStub);

  return fetchStub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestApi", () => {
  test("calls /api/v1 with query parameters and skips empty ones", async () => {
    const fetchStub = stubFetchResponse(Response.json({ items: [] }));

    await requestApi("/emails", {
      queryParameters: { query: "otp", tag: undefined, is_unread: true },
    });

    expect(fetchStub).toHaveBeenCalledWith(
      "/api/v1/emails?query=otp&is_unread=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("sends a JSON body with the right content type", async () => {
    const fetchStub = stubFetchResponse(Response.json({ id: "01JB" }));

    await requestApi("/sms/inbound", {
      method: "POST",
      requestBody: { from: "+1", to: "+2", body: "STOP" },
    });

    expect(fetchStub).toHaveBeenCalledWith(
      "/api/v1/sms/inbound",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"from":"+1","to":"+2","body":"STOP"}',
      }),
    );
  });

  test("returns undefined for 204 No Content", async () => {
    stubFetchResponse(new Response(null, { status: 204 }));

    await expect(
      requestApi("/emails/01JB", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  test("PL-01.2 turns the API error body into an ApiError", async () => {
    stubFetchResponse(
      Response.json(
        { error: { code: "not_found", message: "Email not found" } },
        { status: 404 },
      ),
    );

    const requestError = await requestApi("/emails/missing").catch(
      (caughtError: unknown) => caughtError,
    );

    expect(requestError).toBeInstanceOf(ApiError);
    expect(requestError).toMatchObject({
      statusCode: 404,
      errorCode: "not_found",
      message: "Email not found",
    });
  });

  test("falls back to a generic error when the body is not JSON", async () => {
    stubFetchResponse(new Response("Bad gateway", { status: 502 }));

    await expect(requestApi("/stats")).rejects.toMatchObject({
      statusCode: 502,
      errorCode: "unknown_error",
    });
  });
});

describe("buildRealtimeUrl", () => {
  test("uses ws:// on the same origin as the UI", () => {
    expect(buildRealtimeUrl()).toBe(`ws://${window.location.host}/api/v1/ws`);
  });
});
