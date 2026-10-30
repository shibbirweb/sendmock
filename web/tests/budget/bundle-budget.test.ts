import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type BundleMeasurement,
  distBudgetBytes,
  initialJsBudgetBytes,
  listInitialScriptPaths,
  measureBundle,
} from "./measure-bundle";

const webDirectory = join(import.meta.dir, "../..");
let distDirectory = "";
let bundleMeasurement: BundleMeasurement;

/** The live build, as the binary embeds it: no mock layer, no demo toolbar. */
beforeAll(() => {
  distDirectory = mkdtempSync(join(tmpdir(), "sendmock-dist-"));
  const buildResult = Bun.spawnSync(
    [
      "bun",
      "--bun",
      "vite",
      "build",
      "--outDir",
      distDirectory,
      "--emptyOutDir",
    ],
    {
      cwd: webDirectory,
      env: { ...process.env, NODE_ENV: "production", VITE_API_MODE: "live" },
      stderr: "pipe",
    },
  );
  if (buildResult.exitCode !== 0) {
    throw new Error(buildResult.stderr.toString());
  }
  bundleMeasurement = measureBundle(distDirectory);
  console.log(
    `initial JS ${(bundleMeasurement.initialJsGzipBytes / 1024).toFixed(1)} KB gzipped, dist ${(bundleMeasurement.distBytes / 1024 / 1024).toFixed(2)} MB`,
  );
}, 120_000);

afterAll(() => {
  rmSync(distDirectory, { recursive: true, force: true });
});

describe("bundle budget", () => {
  test("lists the entry script and its preloaded modules", () => {
    expect(
      listInitialScriptPaths(
        [
          '<script type="module" crossorigin src="/assets/index-a1.js"></script>',
          '<link rel="modulepreload" crossorigin href="/assets/react-b2.js">',
          '<link rel="stylesheet" crossorigin href="/assets/index-c3.css">',
        ].join("\n"),
      ),
    ).toEqual(["assets/index-a1.js", "assets/react-b2.js"]);
  });

  test("UI-06.1 the initial JS is under 250 KB gzipped", () => {
    expect(bundleMeasurement.initialJsGzipBytes).toBeLessThan(
      initialJsBudgetBytes,
    );
  });

  test("UI-06.1 CodeMirror is not part of the initial JS", () => {
    const initialScripts = bundleMeasurement.initialScriptPaths.map(
      (scriptPath) => readFileSync(join(distDirectory, scriptPath), "utf8"),
    );

    expect(
      initialScripts.some((scriptContent) =>
        scriptContent.includes("cm-content"),
      ),
    ).toBe(false);
  });

  test("UI-06.3 the embedded dist is under 2 MB without source maps", () => {
    expect(bundleMeasurement.distBytes).toBeLessThan(distBudgetBytes);
  });

  test("UI-06.3 UI-12.3 the live build ships no mock layer", () => {
    expect(
      bundleMeasurement.initialScriptPaths.some((scriptPath) =>
        scriptPath.includes("mock"),
      ),
    ).toBe(false);
  });
});
