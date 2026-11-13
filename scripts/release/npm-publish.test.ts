import { describe, expect, test } from "bun:test";

import {
  buildNpmPublishArguments,
  buildRegistryPackageUrl,
  readNpmPackageState,
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
