import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type BundleMeasurement,
  distBudgetBytes,
  initialJsBudgetBytes,
  listInitialScriptPaths,
  listLargestFiles,
  measureBundle,
} from "./measure-bundle";

const webDirectory = join(import.meta.dir, "../..");
const largestFilesShown = 15;
let distDirectory = "";
let reportDirectory = "";
let moduleReportPath = "";
let bundleMeasurement: BundleMeasurement;

function formatKilobytes(sizeBytes: number): string {
  return `${(sizeBytes / 1024).toFixed(1).padStart(8)} KB`;
}

/** CI is where the budget is measured, so its log names the files and modules to trim. */
function printBundleReport() {
  const largestModules = JSON.parse(readFileSync(moduleReportPath, "utf8")) as {
    modulePath: string;
    renderedBytes: number;
  }[];
  console.log(
    [
      `initial JS ${(bundleMeasurement.initialJsGzipBytes / 1024).toFixed(1)} KB gzipped, dist ${(bundleMeasurement.distBytes / 1024 / 1024).toFixed(2)} MB`,
      "Largest files:",
      ...listLargestFiles(distDirectory, largestFilesShown).map(
        (distFile) =>
          `${formatKilobytes(distFile.sizeBytes)}  ${distFile.relativePath}`,
      ),
      "Largest source modules (as rendered, before minifying):",
      ...largestModules.map(
        (sourceModule) =>
          `${formatKilobytes(sourceModule.renderedBytes)}  ${sourceModule.modulePath}`,
      ),
    ].join("\n"),
  );
}

/** The live build, as the binary embeds it: no mock layer, no demo toolbar. */
beforeAll(() => {
  distDirectory = mkdtempSync(join(tmpdir(), "sendmock-dist-"));
  reportDirectory = mkdtempSync(join(tmpdir(), "sendmock-bundle-report-"));
  moduleReportPath = join(reportDirectory, "largest-modules.json");
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
      env: {
        ...process.env,
        NODE_ENV: "production",
        VITE_API_MODE: "live",
        SENDMOCK_MODULE_REPORT: moduleReportPath,
      },
      stderr: "pipe",
    },
  );
  if (buildResult.exitCode !== 0) {
    throw new Error(buildResult.stderr.toString());
  }
  bundleMeasurement = measureBundle(distDirectory);
  printBundleReport();
}, 120_000);

afterAll(() => {
  rmSync(distDirectory, { recursive: true, force: true });
  rmSync(reportDirectory, { recursive: true, force: true });
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

  test("UI-12.3 the live build leaves out the mock service worker", () => {
    expect(existsSync(join(distDirectory, "mockServiceWorker.js"))).toBe(false);
  });
});
