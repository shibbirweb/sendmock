import { describe, expect, test } from "bun:test";

import {
  findLayerViolations,
  parseCrateManifest,
  readWorkspaceCrateManifests,
} from "./rust-crate-layers";

describe("parseCrateManifest", () => {
  test("reads the package name and only the normal dependencies", () => {
    const manifest = parseCrateManifest(
      [
        "[package]",
        'name = "sendmock-ops"',
        "",
        "[dependencies]",
        "sendmock-core.workspace = true",
        'serde = { version = "1" }',
        "",
        "[dev-dependencies]",
        "sendmock-api.workspace = true",
      ].join("\n"),
    );

    expect(manifest).toEqual({
      crateName: "sendmock-ops",
      dependencyNames: ["sendmock-core", "serde"],
    });
  });
});

describe("findLayerViolations", () => {
  test("allows a dependency on a lower layer", () => {
    const violations = findLayerViolations([
      {
        crateName: "sendmock-api",
        dependencyNames: ["sendmock-ops", "sendmock-core", "axum"],
      },
    ]);

    expect(violations).toEqual([]);
  });

  test("rejects storage depending on a transport crate", () => {
    const violations = findLayerViolations([
      { crateName: "sendmock-store", dependencyNames: ["sendmock-api"] },
    ]);

    expect(violations).toEqual([
      "sendmock-store (storage) depends on sendmock-api (transport); a crate may only depend on lower layers",
    ]);
  });

  test("rejects one transport crate depending on another", () => {
    const violations = findLayerViolations([
      { crateName: "sendmock-cli", dependencyNames: ["sendmock-api"] },
    ]);

    expect(violations).toHaveLength(1);
  });

  test("names a crate that has no layer", () => {
    const violations = findLayerViolations([
      { crateName: "sendmock-payments", dependencyNames: [] },
    ]);

    expect(violations[0]).toContain("sendmock-payments has no layer");
  });
});

describe("the workspace", () => {
  test("every crate depends only on lower layers", () => {
    expect(findLayerViolations(readWorkspaceCrateManifests())).toEqual([]);
  });
});
