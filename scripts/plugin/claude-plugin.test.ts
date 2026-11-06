import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  pluginSkillVersionPattern,
  readTextVersion,
  readWorkspaceVersion,
  writeTextVersion,
} from "../version/version-files";
import {
  findSkillDrift,
  pluginSkillDirectory,
  readSkillFiles,
  renderPluginSkillFiles,
  skillSourceDirectory,
} from "./plugin-skill-files";
import {
  findInstalledPluginProblems,
  type InstalledPluginEntry,
} from "./installed-plugin";

const repositoryRoot = join(import.meta.dir, "../..");

function readJson<Shape>(relativePath: string): Shape {
  return JSON.parse(
    readFileSync(join(repositoryRoot, relativePath), "utf8"),
  ) as Shape;
}

type PluginManifest = {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  homepage: string;
  repository: string;
  license: string;
};

type Marketplace = {
  name: string;
  owner: { name: string };
  plugins: { name: string; source: string; description: string }[];
};

const workspaceVersion = readWorkspaceVersion(
  readFileSync(join(repositoryRoot, "Cargo.toml"), "utf8"),
);
const pluginManifest = readJson<PluginManifest>(
  "plugin/.claude-plugin/plugin.json",
);

describe("Claude Code plugin", () => {
  test("AI-05.5 the manifest names the plugin, this version, its author, links and licence", () => {
    expect(pluginManifest.name).toBe("sendmock");
    expect(pluginManifest.version).toBe(workspaceVersion ?? "");
    expect(pluginManifest.description.length).toBeGreaterThan(20);
    expect(pluginManifest.author.name).toBe("MD. Shibbir Ahmed");
    expect(new URL(pluginManifest.homepage).protocol).toBe("https:");
    expect(pluginManifest.repository).toBe(
      "https://github.com/shibbirweb/sendmock",
    );
    expect(pluginManifest.license).toBe("MIT OR Apache-2.0");
  });

  test("AI-05.5 the repository's marketplace lists the plugin from its folder", () => {
    const marketplace = readJson<Marketplace>(
      ".claude-plugin/marketplace.json",
    );

    expect(marketplace.name).toBe("sendmock");
    expect(marketplace.owner.name).toBe(pluginManifest.author.name);
    expect(marketplace.plugins).toEqual([
      {
        name: pluginManifest.name,
        source: "./plugin",
        description: pluginManifest.description,
      },
    ]);
  });

  test("AI-05.5 the plugin's MCP server is sendmock mcp, as sendmock ai install writes it", () => {
    const mcpConfiguration = readJson<{ mcpServers: Record<string, unknown> }>(
      "plugin/.mcp.json",
    );

    expect(mcpConfiguration).toEqual({
      mcpServers: { sendmock: { command: "sendmock", args: ["mcp"] } },
    });
    expect(
      readFileSync(
        join(repositoryRoot, "crates/sendmock/src/ai_install/install_plan.rs"),
        "utf8",
      ),
    ).toContain('json!({ "command": "sendmock", "args": ["mcp"] })');
  });

  test("AI-05.5 the plugin's skill is the repository's skill with this version filled in", () => {
    const expectedFiles = renderPluginSkillFiles(
      readSkillFiles(join(repositoryRoot, skillSourceDirectory)),
      workspaceVersion ?? "",
    );

    expect(
      findSkillDrift(
        expectedFiles,
        readSkillFiles(join(repositoryRoot, pluginSkillDirectory)),
      ),
    ).toEqual([]);
    expect(expectedFiles.map((skillFile) => skillFile.relativePath)).toContain(
      "SKILL.md",
    );
  });
});

describe("plugin skill copy", () => {
  const sourceFiles = [
    {
      relativePath: "SKILL.md",
      text: "Written for SendMock {{sendmock_version}}. Hi",
    },
    { relativePath: "examples/otp.toml", text: "kept {{sendmock_version}}" },
  ];

  test("AI-05.5 fills the version into SKILL.md only, as sendmock ai skill does", () => {
    expect(renderPluginSkillFiles(sourceFiles, "1.0.0-beta.2")).toEqual([
      {
        relativePath: "SKILL.md",
        text: "Written for SendMock 1.0.0-beta.2. Hi",
      },
      { relativePath: "examples/otp.toml", text: "kept {{sendmock_version}}" },
    ]);
  });

  test("AI-05.5 names the files that are changed, missing or extra in the copy", () => {
    const expectedFiles = renderPluginSkillFiles(sourceFiles, "1.0.0");

    expect(
      findSkillDrift(expectedFiles, [
        { relativePath: "SKILL.md", text: "Written for SendMock 0.9.0. Hi" },
        { relativePath: "examples/old.toml", text: "" },
      ]),
    ).toEqual(["SKILL.md", "examples/otp.toml", "examples/old.toml"]);
    expect(findSkillDrift(expectedFiles, expectedFiles)).toEqual([]);
  });

  test("AI-05.5 the version files read and move the copy's version, beta versions too", () => {
    const skillText = "Written for SendMock 1.0.0-beta.2. SendMock catches";

    expect(readTextVersion(skillText, pluginSkillVersionPattern)).toBe(
      "1.0.0-beta.2",
    );
    expect(
      writeTextVersion(skillText, pluginSkillVersionPattern, "1.0.0"),
    ).toBe("Written for SendMock 1.0.0. SendMock catches");
  });
});

describe("installed plugin check", () => {
  const installedPlugin: InstalledPluginEntry = {
    id: "sendmock@sendmock",
    version: "1.0.0",
    enabled: true,
    installPath: "/home/runner/.claude/plugins/cache/sendmock/sendmock/1.0.0",
    mcpServers: { sendmock: { command: "sendmock", args: ["mcp"] } },
  };

  test("AI-05.5 accepts the plugin installed with this version and its MCP server", () => {
    expect(findInstalledPluginProblems([installedPlugin], "1.0.0")).toEqual([]);
  });

  test("AI-05.5 names a missing install, a wrong version, load errors and a missing server", () => {
    expect(findInstalledPluginProblems([], "1.0.0")).toEqual([
      "sendmock@sendmock is not installed",
    ]);
    expect(
      findInstalledPluginProblems(
        [
          {
            ...installedPlugin,
            enabled: false,
            version: "0.9.0",
            errors: ["skills/sendmock: no SKILL.md"],
            mcpServers: {},
          },
        ],
        "1.0.0",
      ),
    ).toEqual([
      "sendmock@sendmock is not enabled",
      "sendmock@sendmock has version 0.9.0, expected 1.0.0",
      "load error: skills/sendmock: no SKILL.md",
      "the sendmock MCP server is null, expected sendmock mcp",
    ]);
  });
});
