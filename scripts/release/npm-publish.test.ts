import { describe, expect, test } from "bun:test";

import {
  buildNpmLatestTagArguments,
  buildNpmPublishArguments,
  buildRegistryPackageUrl,
  readNpmPackageRecord,
  readNpmPackageState,
  shouldMoveLatestTag,
  toNpmFolderSpec,
} from "./npm-publish";

function answerWithStatus(status: number) {
  return async () => new Response("{}", { status });
}

describe("publishing one npm package", () => {
  test("DS-03.8 stages a package npm does not have yet and publishes one it has", () => {
    expect(
      buildNpmPublishArguments("new", "./npm-packages/sendmock/", "beta"),
    ).toEqual([
      "stage",
      "publish",
      "./npm-packages/sendmock/",
      "--access",
      "public",
      "--tag",
      "beta",
    ]);
    expect(
      buildNpmPublishArguments("published", "./npm-packages/linux-x64/", "latest"),
    ).toEqual([
      "publish",
      "./npm-packages/linux-x64/",
      "--access",
      "public",
      "--tag",
      "latest",
    ]);
  });

  test("DS-03.8 reads a 404 as a new package and fails on any other error", async () => {
    expect(await readNpmPackageState("sendmock", answerWithStatus(404))).toBe(
      "new",
    );
    expect(await readNpmPackageState("sendmock", answerWithStatus(200))).toBe(
      "published",
    );
    expect(
      readNpmPackageState("sendmock", answerWithStatus(503)),
    ).rejects.toThrow("npm answered 503 for sendmock");
  });

  test("DS-03.8 asks the registry for a scoped package by its encoded name", () => {
    expect(buildRegistryPackageUrl("@sendmock/darwin-arm64")).toBe(
      "https://registry.npmjs.org/@sendmock%2fdarwin-arm64",
    );
    expect(buildRegistryPackageUrl("sendmock")).toBe(
      "https://registry.npmjs.org/sendmock",
    );
  });

  test("DS-03.8 names every folder as a path, which npm never reads as a GitHub repository", () => {
    expect(toNpmFolderSpec("npm-packages/sendmock")).toBe(
      "./npm-packages/sendmock/",
    );
    expect(toNpmFolderSpec("./npm-packages/darwin-arm64/")).toBe(
      "./npm-packages/darwin-arm64/",
    );
    expect(toNpmFolderSpec(".")).toBe("./");
  });
});

describe("the latest tag before the first stable", () => {
  test("DS-03.8 reads the version npm's latest tag points at", async () => {
    const answerWithLatest = async () =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "0.0.0-stage", beta: "0.1.0-beta.3" },
        }),
        { status: 200 },
      );

    expect(await readNpmPackageRecord("sendmock", answerWithLatest)).toEqual({
      state: "published",
      latestVersion: "0.0.0-stage",
    });
    expect(
      await readNpmPackageRecord("sendmock", async () => new Response("{}")),
    ).toEqual({ state: "published", latestVersion: null });
  });

  test("DS-03.8 moves latest to a beta over npm's staging placeholder, an older beta or no latest", () => {
    expect(shouldMoveLatestTag("beta", "0.0.0-stage")).toBe(true);
    expect(shouldMoveLatestTag("beta", "0.1.0-beta.2")).toBe(true);
    expect(shouldMoveLatestTag("beta", null)).toBe(true);
  });

  test("DS-03.8 never moves latest over a stable, and a stable publish sets latest itself", () => {
    expect(shouldMoveLatestTag("beta", "1.0.0")).toBe(false);
    expect(shouldMoveLatestTag("latest", "0.0.0-stage")).toBe(false);
  });

  test("DS-03.8 moves latest with npm dist-tag add", () => {
    expect(buildNpmLatestTagArguments("sendmock", "0.1.0-beta.4")).toEqual([
      "dist-tag",
      "add",
      "sendmock@0.1.0-beta.4",
      "latest",
    ]);
  });
});
