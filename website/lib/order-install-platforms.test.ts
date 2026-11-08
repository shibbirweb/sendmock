import { describe, expect, test } from "bun:test";

import {
  installPlatforms,
  orderInstallPlatforms,
} from "../components/landing/install-platforms";

function readKeys(platforms: { key: string }[]): string[] {
  return platforms.map((installPlatform) => installPlatform.key);
}

describe("the quick start's tab order for a visitor", () => {
  test("WS-02.1 the visitor's own system comes first, the rest keep their order", () => {
    expect(readKeys(orderInstallPlatforms(installPlatforms, "macos"))).toEqual([
      "macos",
      "npx",
      "bunx",
      "docker",
      "windows",
      "linux",
    ]);
  });

  test("WS-02.1 an unknown system keeps npx, bunx and Docker in front", () => {
    expect(readKeys(orderInstallPlatforms(installPlatforms, null))).toEqual([
      "npx",
      "bunx",
      "docker",
      "macos",
      "windows",
      "linux",
    ]);
  });
});
