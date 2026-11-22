import { describe, expect, test } from "bun:test";

import { isAnyPathAffected, readPathPatterns } from "./changed-paths";

describe("changed paths", () => {
  test("a change under a folder pattern affects the workflow", () => {
    expect(
      isAnyPathAffected(["crates/sendmock-smtp/src/session.rs"], ["crates/sendmock-smtp/**"]),
    ).toBe(true);
  });

  test("a change to a named file affects the workflow", () => {
    expect(isAnyPathAffected(["Dockerfile"], ["Dockerfile"])).toBe(true);
  });

  test("a change outside every pattern does not", () => {
    expect(
      isAnyPathAffected(["docs/plan/PROGRESS.md"], ["crates/**", "Dockerfile"]),
    ).toBe(false);
  });

  test("a pull request at GitHub's file list limit counts as affected", () => {
    const changedFiles = Array.from({ length: 3000 }, (_, index) => `docs/page-${index}.md`);

    expect(isAnyPathAffected(changedFiles, ["crates/**"])).toBe(true);
  });

  test("patterns are read one per line, blank lines and spaces ignored", () => {
    expect(readPathPatterns("  crates/**\n\n Dockerfile \n")).toEqual([
      "crates/**",
      "Dockerfile",
    ]);
  });
});
