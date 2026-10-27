import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { prepareTagWorktree, removeTagWorktree } from "./docs-version-worktree";

let sandboxDirectory = "";
let repositoryRoot = "";

function runGit(gitArguments: string[]) {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.test",
      ...gitArguments,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
}

function writeRepositoryFile(relativePath: string, fileContent: string) {
  const filePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileContent);
}

beforeEach(() => {
  sandboxDirectory = mkdtempSync(join(tmpdir(), "docs-version-worktree-"));
  repositoryRoot = join(sandboxDirectory, "repository");
  mkdirSync(repositoryRoot);
  runGit(["init", "--quiet"]);

  writeRepositoryFile("docs/wiki/install.md", "Install in v0.1.0\n");
  writeRepositoryFile("docs/api/openapi.yaml", "version: 0.1.0\n");
  writeRepositoryFile("web/src/app.tsx", "the v0.1.0 app\n");
  writeRepositoryFile("website/app/page.tsx", "the v0.1.0 website\n");
  runGit(["add", "--all"]);
  runGit(["commit", "--quiet", "--message", "release 0.1.0"]);
  runGit(["tag", "v0.1.0"]);

  writeRepositoryFile("docs/wiki/install.md", "Install on develop\n");
  writeRepositoryFile("web/src/app.tsx", "the develop app\n");
  writeRepositoryFile("website/app/page.tsx", "today's website\n");
  writeRepositoryFile("website/node_modules/some-package/index.js", "\n");
  writeRepositoryFile("website/out/index.html", "an old build\n");
  runGit(["add", "docs", "web", "website/app"]);
  runGit(["commit", "--quiet", "--message", "work on develop"]);
});

afterEach(() => {
  rmSync(sandboxDirectory, { recursive: true, force: true });
});

test("WS-03.5 a tag is built from its own docs and app with today's website code, leaving the working tree alone", () => {
  const worktreeRoot = prepareTagWorktree({
    repositoryRoot,
    gitRef: "v0.1.0",
    worktreesDirectory: join(sandboxDirectory, "worktrees"),
    shouldInstallDependencies: false,
  });
  const readWorktreeFile = (relativePath: string) =>
    readFileSync(join(worktreeRoot, relativePath), "utf8");

  expect(readWorktreeFile("docs/wiki/install.md")).toBe("Install in v0.1.0\n");
  expect(readWorktreeFile("docs/api/openapi.yaml")).toBe("version: 0.1.0\n");
  expect(readWorktreeFile("web/src/app.tsx")).toBe("the v0.1.0 app\n");
  expect(readWorktreeFile("website/app/page.tsx")).toBe("today's website\n");
  expect(existsSync(join(worktreeRoot, "website/node_modules"))).toBe(false);
  expect(existsSync(join(worktreeRoot, "website/out"))).toBe(false);

  expect(
    readFileSync(join(repositoryRoot, "docs/wiki/install.md"), "utf8"),
  ).toBe("Install on develop\n");
  expect(runGit(["status", "--porcelain", "--untracked-files=no"])).toBe("");

  removeTagWorktree(repositoryRoot, worktreeRoot);
  expect(existsSync(worktreeRoot)).toBe(false);
  expect(runGit(["worktree", "list"]).trim().split("\n")).toHaveLength(1);
});
