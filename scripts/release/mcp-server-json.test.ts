import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readWorkspaceVersion } from "../version/version-files";
import { buildLauncherPackageJson } from "./npm-packages";

const repositoryRoot = join(import.meta.dir, "../..");

function readRepositoryFile(relativePath: string) {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

type ServerInput = { name?: string; value?: string; isSecret?: boolean };

type ServerPackage = {
  registryType: string;
  registryBaseUrl?: string;
  identifier: string;
  version?: string;
  transport: { type: string };
  packageArguments?: ServerInput[];
  environmentVariables?: ServerInput[];
};

type ServerJson = {
  $schema: string;
  name: string;
  description: string;
  version: string;
  packages: ServerPackage[];
};

const serverJson = JSON.parse(readRepositoryFile("server.json")) as ServerJson;
const workspaceVersion = readWorkspaceVersion(readRepositoryFile("Cargo.toml"));

function findPackage(registryType: string): ServerPackage {
  const serverPackage = serverJson.packages.find(
    (candidate) => candidate.registryType === registryType,
  );
  expect(serverPackage).toBeDefined();
  return serverPackage as ServerPackage;
}

describe("MCP registry server.json", () => {
  test("AI-05.6 uses the registry's current schema and a short description", () => {
    expect(serverJson.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    );
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
  });

  test("AI-05.6 the name is the one the npm package and the image claim", () => {
    const dockerLabels = [
      ...readRepositoryFile("Dockerfile").matchAll(
        /io\.modelcontextprotocol\.server\.name="([^"]+)"/g,
      ),
    ].map((labelMatch) => labelMatch[1]);

    expect(serverJson.name).toBe("io.github.shibbirweb/sendmock");
    expect(buildLauncherPackageJson("1.0.0").mcpName).toBe(serverJson.name);
    expect(dockerLabels).toEqual([serverJson.name, serverJson.name]);
  });

  test("AI-05.6 names the npm package and the image with the release's version", () => {
    const npmPackage = findPackage("npm");
    const imagePackage = findPackage("oci");

    expect(serverJson.version).toBe(workspaceVersion ?? "");
    expect(npmPackage.identifier).toBe(buildLauncherPackageJson("1.0.0").name);
    expect(npmPackage.registryBaseUrl).toBe("https://registry.npmjs.org");
    expect(npmPackage.version).toBe(serverJson.version);
    expect(imagePackage.identifier).toBe(
      `ghcr.io/shibbirweb/sendmock:${serverJson.version}`,
    );
  });

  test("AI-05.6 every package runs sendmock mcp over stdio with the variables it reads", () => {
    const mcpArguments = readRepositoryFile(
      "crates/sendmock/src/cli_arguments/mcp_arguments.rs",
    );

    for (const serverPackage of serverJson.packages) {
      expect(serverPackage.transport.type).toBe("stdio");
      expect(serverPackage.packageArguments?.[0]?.value).toBe("mcp");
      const variableNames = (serverPackage.environmentVariables ?? []).map(
        (variable) => variable.name,
      );
      expect(variableNames).toEqual([
        "SENDMOCK_SERVER",
        "SENDMOCK_TOKEN",
        "SENDMOCK_MCP_TOOLSETS",
      ]);
      for (const variableName of variableNames) {
        expect(mcpArguments).toContain(`env = "${variableName}"`);
      }
      const tokenVariable = serverPackage.environmentVariables?.find(
        (variable) => variable.name === "SENDMOCK_TOKEN",
      );
      expect(tokenVariable?.isSecret).toBe(true);
    }
  });
});
