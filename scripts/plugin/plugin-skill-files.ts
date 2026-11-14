import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export const skillSourceDirectory = "skill/sendmock";
export const pluginSkillDirectory = "plugin/skills/sendmock";
const versionPlaceholder = "{{sendmock_version}}";

export type SkillFile = { relativePath: string; text: string };

function listFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFilesUnder(entryPath) : [entryPath];
  });
}

/** Reads every file of a skill folder, by its path inside the folder, in a stable order. */
export function readSkillFiles(directory: string): SkillFile[] {
  return listFilesUnder(directory)
    .map((filePath) => ({
      relativePath: relative(directory, filePath).split("\\").join("/"),
      text: readFileSync(filePath, "utf8"),
    }))
    .sort((first, second) =>
      first.relativePath.localeCompare(second.relativePath),
    );
}

/**
 * The plugin's copy of the skill: the same files, with the version filled in as
 * `sendmock ai skill` serves it.
 */
export function renderPluginSkillFiles(
  sourceFiles: SkillFile[],
  version: string,
): SkillFile[] {
  return sourceFiles.map((sourceFile) => ({
    relativePath: sourceFile.relativePath,
    text:
      sourceFile.relativePath === "SKILL.md"
        ? sourceFile.text.replaceAll(versionPlaceholder, version)
        : sourceFile.text,
  }));
}

/** The paths whose plugin copy is missing, extra or different from the expected copy. */
export function findSkillDrift(
  expectedFiles: SkillFile[],
  pluginFiles: SkillFile[],
): string[] {
  const pluginTextByPath = new Map(
    pluginFiles.map((pluginFile) => [pluginFile.relativePath, pluginFile.text]),
  );
  const expectedPaths = new Set(
    expectedFiles.map((expectedFile) => expectedFile.relativePath),
  );
  const changedOrMissing = expectedFiles
    .filter(
      (expectedFile) =>
        pluginTextByPath.get(expectedFile.relativePath) !== expectedFile.text,
    )
    .map((expectedFile) => expectedFile.relativePath);
  const extra = pluginFiles
    .map((pluginFile) => pluginFile.relativePath)
    .filter((pluginPath) => !expectedPaths.has(pluginPath));
  return [...changedOrMissing, ...extra];
}
