import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One entry of `claude plugin list --json`, with the fields this check reads. */
export type InstalledPluginEntry = {
  id: string;
  version: string;
  enabled: boolean;
  installPath: string;
  readFromFolder?: string;
  mcpServers?: Record<string, { command?: string; args?: string[] }>;
  errors?: string[];
};

export const pluginId = "sendmock@sendmock";

/** What is wrong with the installed plugin, or an empty list (AI-05.5). */
export function findInstalledPluginProblems(
  installedPlugins: InstalledPluginEntry[],
  expectedVersion: string,
): string[] {
  const installedPlugin = installedPlugins.find(
    (pluginEntry) => pluginEntry.id === pluginId,
  );
  if (installedPlugin === undefined) {
    return [`${pluginId} is not installed`];
  }
  const problems: string[] = [];
  if (!installedPlugin.enabled) {
    problems.push(`${pluginId} is not enabled`);
  }
  if (installedPlugin.version !== expectedVersion) {
    problems.push(
      `${pluginId} has version ${installedPlugin.version}, expected ${expectedVersion}`,
    );
  }
  for (const loadError of installedPlugin.errors ?? []) {
    problems.push(`load error: ${loadError}`);
  }
  const mcpServer = installedPlugin.mcpServers?.sendmock;
  if (
    mcpServer?.command !== "sendmock" ||
    mcpServer.args?.join(" ") !== "mcp"
  ) {
    problems.push(
      `the sendmock MCP server is ${JSON.stringify(mcpServer ?? null)}, expected sendmock mcp`,
    );
  }
  return problems;
}

/** Where sessions read the installed plugin from: its folder in place, or the cache copy. */
export function readInstalledSkill(
  installedPlugin: InstalledPluginEntry,
): string | null {
  const pluginFolder =
    installedPlugin.readFromFolder ?? installedPlugin.installPath;
  const skillPath = join(pluginFolder, "skills/sendmock/SKILL.md");
  return existsSync(skillPath) ? readFileSync(skillPath, "utf8") : null;
}
