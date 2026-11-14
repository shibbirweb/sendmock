#!/usr/bin/env bun
/**
 * The Claude Code plugin carries a copy of the skill, since an installed plugin is copied into
 * a cache and cannot read outside its folder (docs/plan/30-phase-5.md, W9a).
 *
 *     bun scripts/plugin-skill.ts sync     write plugin/skills/sendmock from skill/sendmock
 *     bun scripts/plugin-skill.ts check    fail when the copy differs
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  findSkillDrift,
  pluginSkillDirectory,
  readSkillFiles,
  renderPluginSkillFiles,
  skillSourceDirectory,
} from "./plugin/plugin-skill-files";
import {
  readWorkspaceVersion,
  workspaceManifestPath,
} from "./version/version-files";

const repositoryRoot = join(import.meta.dir, "..");
const workspaceVersion = readWorkspaceVersion(
  readFileSync(join(repositoryRoot, workspaceManifestPath), "utf8"),
);
if (workspaceVersion === null) {
  console.error(`No version in ${workspaceManifestPath}`);
  process.exit(1);
}

const expectedFiles = renderPluginSkillFiles(
  readSkillFiles(join(repositoryRoot, skillSourceDirectory)),
  workspaceVersion,
);
const pluginDirectory = join(repositoryRoot, pluginSkillDirectory);
const command = process.argv[2];

if (command === "sync") {
  rmSync(pluginDirectory, { recursive: true, force: true });
  for (const expectedFile of expectedFiles) {
    const filePath = join(pluginDirectory, expectedFile.relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, expectedFile.text);
  }
  console.log(`Wrote ${expectedFiles.length} files to ${pluginSkillDirectory}`);
} else if (command === "check") {
  const driftedPaths = findSkillDrift(
    expectedFiles,
    readSkillFiles(pluginDirectory),
  );
  if (driftedPaths.length > 0) {
    console.error(
      `${pluginSkillDirectory} differs from ${skillSourceDirectory} in: ${driftedPaths.join(", ")}. Run bun scripts/plugin-skill.ts sync.`,
    );
    process.exit(1);
  }
  console.log(`${pluginSkillDirectory} matches ${skillSourceDirectory}`);
} else {
  console.error("Usage: bun scripts/plugin-skill.ts sync|check");
  process.exit(1);
}
