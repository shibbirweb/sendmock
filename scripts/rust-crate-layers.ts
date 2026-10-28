#!/usr/bin/env bun
/**
 * Rust crate dependency direction (AGENTS.md, Layers and dependency direction).
 *
 *     bun scripts/rust-crate-layers.ts
 *
 * Each crate under crates/ belongs to one layer. A crate may depend only on crates in a
 * lower layer, so storage never reaches up into operations and transports never call
 * each other. Fails when a crate breaks that rule or has no layer.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");
const cratesDirectory = join(repositoryRoot, "crates");

/** Higher number, higher layer. `sendmock-core` is the shared foundation under everything. */
export const crateLayers: Record<
  string,
  { layerName: string; layerRank: number }
> = {
  "sendmock-core": { layerName: "foundation", layerRank: 0 },
  "sendmock-store": { layerName: "storage", layerRank: 1 },
  "sendmock-mail": { layerName: "domain", layerRank: 2 },
  "sendmock-sms": { layerName: "domain", layerRank: 2 },
  "sendmock-webhooks": { layerName: "domain", layerRank: 2 },
  "sendmock-ops": { layerName: "operations", layerRank: 3 },
  "sendmock-smtp": { layerName: "transport", layerRank: 4 },
  "sendmock-api": { layerName: "transport", layerRank: 4 },
  "sendmock-cli": { layerName: "transport", layerRank: 4 },
  "sendmock-mcp": { layerName: "transport", layerRank: 4 },
  sendmock: { layerName: "application", layerRank: 5 },
};

export type CrateManifest = {
  crateName: string;
  dependencyNames: string[];
};

/** Reads the package name and the names in `[dependencies]` (not dev or build ones). */
export function parseCrateManifest(manifestToml: string): CrateManifest {
  const manifest = Bun.TOML.parse(manifestToml) as {
    package?: { name?: string };
    dependencies?: Record<string, unknown>;
  };
  return {
    crateName: manifest.package?.name ?? "",
    dependencyNames: Object.keys(manifest.dependencies ?? {}),
  };
}

/** Lists every dependency on a SendMock crate in the same or a higher layer. */
export function findLayerViolations(crateManifests: CrateManifest[]): string[] {
  const violations: string[] = [];
  for (const { crateName, dependencyNames } of crateManifests) {
    const crateLayer = crateLayers[crateName];
    if (!crateLayer) {
      violations.push(
        `${crateName} has no layer; add it to crateLayers in scripts/rust-crate-layers.ts`,
      );
      continue;
    }
    for (const dependencyName of dependencyNames) {
      const dependencyLayer = crateLayers[dependencyName];
      if (!dependencyLayer) {
        continue;
      }
      if (dependencyLayer.layerRank >= crateLayer.layerRank) {
        violations.push(
          `${crateName} (${crateLayer.layerName}) depends on ${dependencyName} (${dependencyLayer.layerName}); a crate may only depend on lower layers`,
        );
      }
    }
  }
  return violations;
}

export function readWorkspaceCrateManifests(): CrateManifest[] {
  return readdirSync(cratesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      parseCrateManifest(
        readFileSync(join(cratesDirectory, entry.name, "Cargo.toml"), "utf8"),
      ),
    );
}

if (import.meta.main) {
  const violations = findLayerViolations(readWorkspaceCrateManifests());
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exit(1);
  }
  console.log("Every crate depends only on lower layers.");
}
