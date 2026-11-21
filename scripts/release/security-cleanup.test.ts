import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The repository side of 1.3.1's security clean-up (A22). GitHub's own lists (open alerts and
 * Dependabot pull requests) are read live by `scripts/release-readiness.ts` in runbook step 11;
 * these tests keep what the repository holds from sliding back: the patched versions, the written
 * dismissals and the CI jobs that run every upgraded module against a real `sendmock`.
 */

type PatchedPackage = {
  manifestPath: string;
  packageName: string;
  versionPattern: RegExp;
  firstPatchedVersion: string;
};

/** GitHub's first patched version for each alert 1.3.1 fixed, the highest per package. */
const patchedPackages: PatchedPackage[] = [
  {
    manifestPath: "examples/payments/paypal-node/package.json",
    packageName: "axios",
    versionPattern: /"axios": "\^?~?(\d[\w.]*)"/g,
    firstPatchedVersion: "1.20.0",
  },
  {
    manifestPath: "examples/smtp/python-django/requirements.txt",
    packageName: "Django",
    versionPattern: /^Django==(\S+)$/gim,
    firstPatchedVersion: "5.2.17",
  },
  {
    manifestPath: "examples/smtp/node-nodemailer/package.json",
    packageName: "nodemailer",
    versionPattern: /"nodemailer": "\^?~?(\d[\w.]*)"/g,
    firstPatchedVersion: "10.1.4",
  },
  {
    manifestPath: "examples/smtp/python-pytest/requirements.txt",
    packageName: "pytest",
    versionPattern: /^pytest==(\S+)$/gm,
    firstPatchedVersion: "9.0.3",
  },
  {
    manifestPath: "examples/smtp/dotnet-mailkit/SendWithMailKit.csproj",
    packageName: "MailKit",
    versionPattern: /Include="MailKit" Version="([^"]+)"/g,
    firstPatchedVersion: "4.16.0",
  },
  {
    manifestPath: "testcontainers/python/pyproject.toml",
    packageName: "pytest",
    versionPattern: /"pytest==([^"]+)"/g,
    firstPatchedVersion: "9.0.3",
  },
  {
    manifestPath: "testcontainers/go/go.mod",
    packageName: "go.opentelemetry.io/otel/trace",
    versionPattern: /go\.opentelemetry\.io\/otel\/trace v(\S+)/g,
    firstPatchedVersion: "1.47.0",
  },
  {
    manifestPath: "testcontainers/go/go.mod",
    packageName: "github.com/klauspost/compress",
    versionPattern: /github\.com\/klauspost\/compress v(\S+)/g,
    firstPatchedVersion: "1.18.7",
  },
  {
    manifestPath: "testcontainers/go/go.mod",
    packageName: "github.com/moby/sys/user",
    versionPattern: /github\.com\/moby\/sys\/user v(\S+)/g,
    firstPatchedVersion: "0.4.1",
  },
  {
    manifestPath: "testcontainers/go/go.mod",
    packageName: "github.com/moby/go-archive",
    versionPattern: /github\.com\/moby\/go-archive v(\S+)/g,
    firstPatchedVersion: "0.3.0",
  },
];

/** Compares dotted release numbers part by part; a pre-release suffix counts as older. */
function compareReleaseVersions(
  leftVersion: string,
  rightVersion: string,
): number {
  const readParts = (version: string) =>
    (version.split("-")[0] ?? "")
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = readParts(leftVersion);
  const rightParts = readParts(rightVersion);
  for (
    let partIndex = 0;
    partIndex < Math.max(leftParts.length, rightParts.length);
    partIndex++
  ) {
    const difference =
      (leftParts[partIndex] ?? 0) - (rightParts[partIndex] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  const isLeftPreRelease = leftVersion.includes("-");
  const isRightPreRelease = rightVersion.includes("-");
  return Number(isRightPreRelease) - Number(isLeftPreRelease);
}

function readPinnedVersions({
  manifestPath,
  versionPattern,
}: PatchedPackage): string[] {
  const manifestContent = readFileSync(manifestPath, "utf8");
  return [...manifestContent.matchAll(versionPattern)].map(
    (match) => match[1] ?? "",
  );
}

function readSecurityCleanupPlan(): string {
  const afterReleasePlan = readFileSync("docs/plan/32-after-1-0.md", "utf8");
  const sectionStart = afterReleasePlan.indexOf("## A22.");
  const sectionEnd = afterReleasePlan.indexOf("\n## ", sectionStart + 1);
  return afterReleasePlan.slice(sectionStart, sectionEnd);
}

type MatrixWorkflow = {
  jobs: Record<
    string,
    { strategy?: { matrix?: { include?: { folder?: string }[] } } }
  >;
};

function listMatrixFolders(workflowPath: string): string[] {
  const workflow = Bun.YAML.parse(
    readFileSync(workflowPath, "utf8"),
  ) as MatrixWorkflow;
  return Object.values(workflow.jobs).flatMap(
    (job) =>
      job.strategy?.matrix?.include?.map((entry) => entry.folder ?? "") ?? [],
  );
}

describe("1.3.1 security clean-up", () => {
  test("PL-19.1 the CodeQL finding is fixed in the code and the false positive's dismissal is written in the plan", () => {
    const siteUrlSource = readFileSync("website/lib/seo/site-url.ts", "utf8");
    const securityCleanupPlan = readSecurityCleanupPlan();

    expect(siteUrlSource).not.toContain("/^\\/+|\\/+$/g");
    expect(securityCleanupPlan).toContain(
      "**Code scanning alert #60, `rust/unsafe-deserialization`",
    );
    expect(securityCleanupPlan).toContain('reason "false positive"');
  });

  test("PL-19.2 every package with a Dependabot alert is at or past its first patched version", () => {
    const unpatchedPins = patchedPackages.flatMap((patchedPackage) => {
      const pinnedVersions = readPinnedVersions(patchedPackage);
      if (pinnedVersions.length === 0) {
        return [
          `${patchedPackage.packageName} not found in ${patchedPackage.manifestPath}`,
        ];
      }
      return pinnedVersions
        .filter(
          (pinnedVersion) =>
            compareReleaseVersions(
              pinnedVersion,
              patchedPackage.firstPatchedVersion,
            ) < 0,
        )
        .map(
          (pinnedVersion) =>
            `${patchedPackage.packageName} ${pinnedVersion} in ${patchedPackage.manifestPath}`,
        );
    });

    expect(unpatchedPins).toEqual([]);
  });

  test("PL-19.2 the one alert without a reachable fix is dismissed with its reason written in the plan", () => {
    const securityCleanupPlan = readSecurityCleanupPlan();

    expect(securityCleanupPlan).toContain(
      "**Dependabot alert #1, `glib` 0.18.5",
    );
    expect(securityCleanupPlan).toContain('reason "vulnerable code not used"');
  });

  test("PL-19.3 the plan says where each Dependabot pull request open on 2026-11-17 went", () => {
    const securityCleanupPlan = readSecurityCleanupPlan();

    for (const pullRequestNumber of [
      201, 202, 203, 204, 205, 228, 243, 247, 327,
    ]) {
      expect(securityCleanupPlan).toContain(`#${pullRequestNumber}`);
    }
    expect(securityCleanupPlan).toContain("closed with a comment");
  });

  test("PL-19.4 CI runs every upgraded example and Testcontainers module against a real sendmock", () => {
    const smtpClientFolders = listMatrixFolders(
      ".github/workflows/smtp-clients.yml",
    );
    const testcontainersFolders = listMatrixFolders(
      ".github/workflows/testcontainers.yml",
    );
    const paymentAppsWorkflow = readFileSync(
      ".github/workflows/payment-apps.yml",
      "utf8",
    );

    expect(smtpClientFolders).toEqual(
      expect.arrayContaining([
        "python-django",
        "node-nodemailer",
        "python-pytest",
        "dotnet-mailkit",
      ]),
    );
    expect(testcontainersFolders).toEqual(
      expect.arrayContaining(["go", "python"]),
    );
    expect(paymentAppsWorkflow).toContain(
      "working-directory: examples/payments/paypal-node",
    );
  });

  test("a newer release number compares as newer, and a pre-release as older than its release", () => {
    expect(compareReleaseVersions("1.21.1", "1.20.0")).toBeGreaterThan(0);
    expect(compareReleaseVersions("10.6.1", "9.9.9")).toBeGreaterThan(0);
    expect(compareReleaseVersions("4.16.0", "4.16.0")).toBe(0);
    expect(compareReleaseVersions("4.16.0-rc.1", "4.16.0")).toBeLessThan(0);
    expect(compareReleaseVersions("0.3", "0.3.0")).toBe(0);
  });
});
