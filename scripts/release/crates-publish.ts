#!/usr/bin/env bun
/**
 * Publishes every workspace crate to crates.io in dependency order (DS-03.1, DS-03.8). crates.io
 * sets a trusted publisher only on a crate that exists, so the first release publishes with the
 * `CARGO_REGISTRY_TOKEN` secret and later ones with the OIDC token; the workflow passes either.
 * A crate that already has the version is skipped, so a re-run finishes a partial publish, and
 * crates.io's rate limit on new crates is waited out.
 *
 *     bun scripts/release/crates-publish.ts
 */

export type WorkspaceCrate = {
  name: string;
  version: string;
  workspaceDependencyNames: string[];
};

type CargoMetadata = {
  packages: {
    name: string;
    version: string;
    publish: string[] | null;
    dependencies: { name: string; kind: string | null; path?: string }[];
  }[];
};

type CargoPublishResult = { exitCode: number; outputText: string };

export type CratesPublisher = {
  isVersionPublished: (
    crateName: string,
    crateVersion: string,
  ) => Promise<boolean>;
  runCargoPublish: (crateName: string) => CargoPublishResult;
  sleep: (delayMs: number) => Promise<void>;
  nowMs: () => number;
};

const userAgent =
  "sendmock-release-workflow (https://github.com/shibbirweb/sendmock)";
const maxRateLimitWaits = 12;
const fallbackRetryDelayMs = 10 * 60 * 1000;

/** The crates `cargo publish` would send (`publish = false` leaves a crate out), with the workspace crates each one needs first. */
export function readWorkspaceCrates(metadata: CargoMetadata): WorkspaceCrate[] {
  const publishedPackages = metadata.packages.filter(
    (cargoPackage) =>
      cargoPackage.publish === null || cargoPackage.publish.length > 0,
  );
  const workspaceNames = new Set(
    publishedPackages.map((cargoPackage) => cargoPackage.name),
  );

  return publishedPackages.map((cargoPackage) => ({
    name: cargoPackage.name,
    version: cargoPackage.version,
    // Dev dependencies are stripped from the published crate, so they never order the publish.
    workspaceDependencyNames: cargoPackage.dependencies
      .filter(
        (dependency) =>
          dependency.kind !== "dev" &&
          dependency.path !== undefined &&
          workspaceNames.has(dependency.name),
      )
      .map((dependency) => dependency.name),
  }));
}

/** Orders the crates so each comes after the workspace crates it depends on, keeping the input order otherwise. */
export function orderByDependencies(
  workspaceCrates: WorkspaceCrate[],
): WorkspaceCrate[] {
  const orderedCrates: WorkspaceCrate[] = [];
  const placedNames = new Set<string>();
  let remainingCrates = [...workspaceCrates];
  while (remainingCrates.length > 0) {
    const readyCrates = remainingCrates.filter((workspaceCrate) =>
      workspaceCrate.workspaceDependencyNames.every((dependencyName) =>
        placedNames.has(dependencyName),
      ),
    );
    if (readyCrates.length === 0) {
      const cycleNames = remainingCrates.map(
        (workspaceCrate) => workspaceCrate.name,
      );
      throw new Error(
        `the workspace crates depend on each other in a cycle: ${cycleNames.join(", ")}`,
      );
    }
    for (const readyCrate of readyCrates) {
      orderedCrates.push(readyCrate);
      placedNames.add(readyCrate.name);
    }
    remainingCrates = remainingCrates.filter(
      (workspaceCrate) => !placedNames.has(workspaceCrate.name),
    );
  }

  return orderedCrates;
}

export function buildCrateVersionUrl(
  crateName: string,
  crateVersion: string,
): string {
  return `https://crates.io/api/v1/crates/${crateName}/${crateVersion}`;
}

/** Whether crates.io has the version, failing on any other answer so an outage never skips a crate. */
export async function isCrateVersionPublished(
  crateName: string,
  crateVersion: string,
  fetchCrateVersion: (
    versionUrl: string,
    init: RequestInit,
  ) => Promise<Response> = fetch,
): Promise<boolean> {
  const response = await fetchCrateVersion(
    buildCrateVersionUrl(crateName, crateVersion),
    {
      headers: { "User-Agent": userAgent },
    },
  );
  if (response.status === 200) {
    return true;
  }
  if (response.status === 404) {
    return false;
  }
  throw new Error(
    `crates.io answered ${response.status} for ${crateName} ${crateVersion}`,
  );
}

/**
 * How long to wait when crates.io refused the publish for its rate limit ("Please try again
 * after <date> or email help@crates.io"), or null for any other failure.
 */
export function readRateLimitDelayMs(
  outputText: string,
  nowMs: number,
): number | null {
  const isRateLimited = /status 429|published too many/i.test(outputText);
  if (!isRateLimited) {
    return null;
  }
  const retryDate = /try again after (.+? GMT)/.exec(outputText)?.[1] ?? null;
  const retryAtMs = retryDate === null ? Number.NaN : Date.parse(retryDate);
  if (Number.isNaN(retryAtMs)) {
    return fallbackRetryDelayMs;
  }

  return Math.max(retryAtMs - nowMs, 0) + 5_000;
}

async function publishOneCrate(
  workspaceCrate: WorkspaceCrate,
  publisher: CratesPublisher,
): Promise<number> {
  for (let waitCount = 0; ; waitCount += 1) {
    const { exitCode, outputText } = publisher.runCargoPublish(
      workspaceCrate.name,
    );
    if (exitCode === 0) {
      return 0;
    }
    const delayMs = readRateLimitDelayMs(outputText, publisher.nowMs());
    if (delayMs === null || waitCount >= maxRateLimitWaits) {
      return exitCode;
    }
    console.log(
      `crates.io rate limit: waiting ${Math.ceil(delayMs / 1000)} s before publishing ${workspaceCrate.name} again.`,
    );
    await publisher.sleep(delayMs);
  }
}

/** Publishes the crates in dependency order and returns the first failing exit code, or 0. */
export async function publishWorkspaceCrates(
  workspaceCrates: WorkspaceCrate[],
  publisher: CratesPublisher,
): Promise<number> {
  for (const workspaceCrate of orderByDependencies(workspaceCrates)) {
    if (
      await publisher.isVersionPublished(
        workspaceCrate.name,
        workspaceCrate.version,
      )
    ) {
      console.log(
        `${workspaceCrate.name} ${workspaceCrate.version} is already on crates.io: skipped.`,
      );
      continue;
    }
    const exitCode = await publishOneCrate(workspaceCrate, publisher);
    if (exitCode !== 0) {
      return exitCode;
    }
  }

  return 0;
}

function runCargoPublish(crateName: string): CargoPublishResult {
  const cargoResult = Bun.spawnSync(
    ["cargo", "publish", "--package", crateName, "--locked", "--allow-dirty"],
    { stdout: "inherit", stderr: "pipe" },
  );
  const outputText = cargoResult.stderr.toString();
  process.stderr.write(outputText);

  return { exitCode: cargoResult.exitCode, outputText };
}

if (import.meta.main) {
  const metadataResult = Bun.spawnSync([
    "cargo",
    "metadata",
    "--no-deps",
    "--format-version",
    "1",
    "--locked",
  ]);
  if (metadataResult.exitCode !== 0) {
    process.stderr.write(metadataResult.stderr.toString());
    process.exit(metadataResult.exitCode);
  }
  const workspaceCrates = readWorkspaceCrates(
    JSON.parse(metadataResult.stdout.toString()) as CargoMetadata,
  );
  process.exit(
    await publishWorkspaceCrates(workspaceCrates, {
      isVersionPublished: (crateName, crateVersion) =>
        isCrateVersionPublished(crateName, crateVersion),
      runCargoPublish,
      sleep: (delayMs) => Bun.sleep(delayMs),
      nowMs: () => Date.now(),
    }),
  );
}
