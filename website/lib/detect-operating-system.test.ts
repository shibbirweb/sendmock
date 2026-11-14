import { describe, expect, test } from "bun:test";

import { detectOperatingSystem } from "./detect-operating-system";

const userAgents = {
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  macos:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("the visitor's operating system", () => {
  test("WS-02.1 desktop Windows, macOS and Linux pick their install tab", () => {
    expect(detectOperatingSystem(userAgents.windows)).toBe("windows");
    expect(detectOperatingSystem(userAgents.macos)).toBe("macos");
    expect(detectOperatingSystem(userAgents.linux)).toBe("linux");
  });

  test("WS-02.1 phones, tablets and ChromeOS keep the default tab", () => {
    expect(detectOperatingSystem(userAgents.android)).toBeNull();
    expect(detectOperatingSystem(userAgents.iphone)).toBeNull();
    expect(detectOperatingSystem(userAgents.chromeOs)).toBeNull();
    expect(detectOperatingSystem("")).toBeNull();
  });
});
