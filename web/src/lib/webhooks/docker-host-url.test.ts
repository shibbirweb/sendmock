import { describe, expect, test } from "vitest";

import { isLoopbackUrl, toDockerHostUrl } from "@/lib/webhooks/docker-host-url";

describe("docker host URLs", () => {
  test("WH-01.4 spots loopback URLs", () => {
    expect(isLoopbackUrl("http://localhost:8000/hooks")).toBe(true);
    expect(isLoopbackUrl("http://127.0.0.1:3000/sms")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:3000/sms")).toBe(true);
    expect(isLoopbackUrl("https://example.com/hooks")).toBe(false);
    expect(isLoopbackUrl("{{ vars.base_url }}/hooks")).toBe(false);
  });

  test("WH-01.4 swaps the host for host.docker.internal", () => {
    expect(toDockerHostUrl("http://localhost:8000/hooks?a=1")).toBe(
      "http://host.docker.internal:8000/hooks?a=1",
    );
  });
});
