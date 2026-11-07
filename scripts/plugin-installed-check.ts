#!/usr/bin/env bun
/**
 * Checks the plugin Claude Code installed from the repository's marketplace (AI-05.5).
 *
 *     bun scripts/plugin-installed-check.ts <plugin-list.json> <skill-from-binary.md>
 *
 * The first file is `claude plugin list --json`, the second `sendmock ai skill`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  findInstalledPluginProblems,
  type InstalledPluginEntry,
  pluginId,
  readInstalledSkill,
} from "./plugin/installed-plugin";
import { readWorkspaceVersion } from "./version/version-files";

const [pluginListPath, binarySkillPath] = process.argv.slice(2);
if (pluginListPath === undefined || binarySkillPath === undefined) {
  console.error(
    "Usage: bun scripts/plugin-installed-check.ts <plugin-list.json> <skill-from-binary.md>",
  );
  process.exit(1);
}

const installedPlugins = JSON.parse(
  readFileSync(pluginListPath, "utf8"),
) as InstalledPluginEntry[];
const workspaceVersion =
  readWorkspaceVersion(
    readFileSync(join(import.meta.dir, "..", "Cargo.toml"), "utf8"),
  ) ?? "";
const problems = findInstalledPluginProblems(
  installedPlugins,
  workspaceVersion,
);
const installedPlugin = installedPlugins.find(
  (pluginEntry) => pluginEntry.id === pluginId,
);
if (installedPlugin !== undefined) {
  const installedSkill = readInstalledSkill(installedPlugin);
  if (installedSkill === null) {
    problems.push("the installed plugin has no skills/sendmock/SKILL.md");
  } else if (installedSkill !== readFileSync(binarySkillPath, "utf8")) {
    problems.push("the installed skill differs from sendmock ai skill");
  }
}

for (const problem of problems) {
  console.log(`::error title=Claude Code plugin::${problem}`);
}
if (problems.length > 0) {
  process.exit(1);
}
console.log(`${pluginId} is installed with the skill sendmock ai skill serves`);
