#!/usr/bin/env bun
/**
 * A setup exported by the previous stable release imports into this build.
 *
 *     bun scripts/setup-compatibility-test.ts <previous sendmock> <this build's sendmock>
 *
 * The previous release applies a known seed and exports it, with `POST /setup/export` when it
 * serves it and `GET /seed/export` before that. This build then previews the file, imports it,
 * and previews it again: the second preview must list no change, so nothing was lost.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  type RunningSendmock,
  startSendmock,
  stopSendmock,
  withExecutableSuffix,
} from "./binary-smoke-test";

type SetupValidation = {
  is_valid: boolean;
  format_version: number;
  errors: { message: string }[];
  changes: { section: string }[];
};

const previousReleaseSetup = readFileSync(
  join(import.meta.dir, "setup-compatibility/previous-release-setup.toml"),
  "utf8",
);

async function startInMemory(binaryPath: string): Promise<RunningSendmock> {
  return startSendmock(withExecutableSuffix(binaryPath), [
    "--http-addr",
    "127.0.0.1:0",
    "--smtp-addr",
    "127.0.0.1:0",
    "--db",
    "memory",
  ]);
}

async function postJson(
  apiUrl: string,
  requestBody: unknown,
): Promise<Response> {
  return fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}

async function exportFromPreviousRelease(binaryPath: string): Promise<string> {
  const runningSendmock = await startInMemory(binaryPath);
  const apiUrl = `http://${runningSendmock.httpAddress}/api/v1`;
  try {
    const applyResponse = await postJson(`${apiUrl}/seed/apply`, {
      seed_toml: previousReleaseSetup,
    });
    check(
      applyResponse.status === 200,
      "the previous release applies the seed",
    );

    const setupExport = await postJson(`${apiUrl}/setup/export`, {
      format: "toml",
    });
    if (setupExport.status === 200) {
      console.log("ok   the previous release exports with POST /setup/export");
      return await setupExport.text();
    }
    const seedExport = await fetch(`${apiUrl}/seed/export`);
    check(
      seedExport.status === 200,
      "the previous release exports with GET /seed/export",
    );
    return await seedExport.text();
  } finally {
    await stopSendmock(runningSendmock);
  }
}

async function importIntoThisBuild(binaryPath: string, setupText: string) {
  const runningSendmock = await startInMemory(binaryPath);
  const apiUrl = `http://${runningSendmock.httpAddress}/api/v1`;
  const previewSetup = async (): Promise<SetupValidation> =>
    (await (
      await postJson(`${apiUrl}/setup/validate`, { setup_text: setupText })
    ).json()) as SetupValidation;
  try {
    const firstPreview = await previewSetup();
    check(
      firstPreview.is_valid,
      `this build reads the export (format ${firstPreview.format_version}) ${firstPreview.errors
        .map((setupError) => setupError.message)
        .join("; ")}`,
    );
    check(
      firstPreview.changes.length > 0,
      "the preview lists what the import adds",
    );

    const importResponse = await postJson(`${apiUrl}/setup/import`, {
      setup_text: setupText,
    });
    check(importResponse.status === 200, "this build imports the export");

    const secondPreview = await previewSetup();
    check(
      secondPreview.changes.length === 0,
      `after the import, the file holds nothing this build lacks (${secondPreview.changes
        .map((sectionChange) => sectionChange.section)
        .join(", ")})`,
    );

    const virtualNumbers = (await (
      await fetch(`${apiUrl}/numbers`)
    ).json()) as { number: string }[];
    check(
      virtualNumbers.some(
        (virtualNumber) => virtualNumber.number === "+15550001111",
      ),
      "the imported number is listed",
    );
  } finally {
    await stopSendmock(runningSendmock);
  }
}

async function main() {
  const [previousBinary, currentBinary] = process.argv.slice(2);
  if (previousBinary === undefined || currentBinary === undefined) {
    console.error(
      "Usage: bun scripts/setup-compatibility-test.ts <previous sendmock> <this build's sendmock>",
    );
    process.exit(2);
  }
  const setupText = await exportFromPreviousRelease(previousBinary);
  await importIntoThisBuild(currentBinary, setupText);
}

if (import.meta.main) {
  await main();
}
