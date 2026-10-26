import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { surfaceCatalogue } from "../../src/lib/api/surface-catalogue";

// Tests run from web/; the plan is in the repository docs.
const aiPlanText = readFileSync(
  resolve(process.cwd(), "../docs/plan/14-ai-integration.md"),
  "utf8",
);

/** Commands that start the servers or print help (`sendmock <command> --help`), not operations. */
const processCommands = [
  "sendmock serve",
  "sendmock mcp",
  "sendmock help",
  "sendmock",
];

const catalogueEntries = Object.entries(surfaceCatalogue);

/** `sendmock email reply <emailId> --to x` to `sendmock email reply`. */
function readCommandWords(commandText: string): string {
  const literalWords: string[] = [];
  for (const commandWord of commandText.trim().split(/\s+/)) {
    if (/^[<\-[{"#]/.test(commandWord) || /[|=]/.test(commandWord)) {
      break;
    }
    literalWords.push(commandWord);
  }

  return literalWords.join(" ");
}

/** A command matches when it starts with a catalogue command's literal words; the rest are its arguments. */
function isCatalogueCommand(commandText: string): boolean {
  if (/\s--help\b/.test(commandText)) {
    return true;
  }
  const commandWords = readCommandWords(commandText);

  return [...catalogueCommands].some(
    (catalogueCommand) =>
      commandWords === catalogueCommand ||
      commandWords.startsWith(`${catalogueCommand} `),
  );
}

const catalogueCommands = new Set(
  catalogueEntries.flatMap(([, operationSurfaces]) =>
    [operationSurfaces.cli, ...(operationSurfaces.cliAliases ?? [])].map(
      readCommandWords,
    ),
  ),
);
const catalogueTools = new Set(
  catalogueEntries.flatMap(([, operationSurfaces]) => [
    operationSurfaces.mcp ?? "",
    ...(operationSurfaces.mcpAliases ?? []),
  ]),
);

/** Every `sendmock ...` command in the plan: inline code and lines of code blocks. */
function listPlanCommands(): string[] {
  const inlineCommands = [...aiPlanText.matchAll(/`(sendmock [^`]+)`/g)].map(
    (commandMatch) => commandMatch[1] ?? "",
  );
  const blockCommands = [...aiPlanText.matchAll(/```[\s\S]*?```/g)].flatMap(
    (blockMatch) =>
      (blockMatch[0] ?? "")
        .split("\n")
        .filter((blockLine) => blockLine.startsWith("sendmock ")),
  );

  return [...inlineCommands, ...blockCommands].map(readCommandWords);
}

describe("the AI plan and the surface catalogue", () => {
  test("UI-11.2 every MCP tool named in the AI plan runs an operation", () => {
    const planTools = new Set(
      [...aiPlanText.matchAll(/\bsendmock_[a-z_]+\b/g)].map(
        (toolMatch) => toolMatch[0],
      ),
    );

    expect(
      [...planTools].filter((toolName) => !catalogueTools.has(toolName)),
    ).toEqual([]);
  });

  test("UI-11.2 every CLI command named in the AI plan runs an operation", () => {
    const unmappedCommands = listPlanCommands().filter(
      (commandWords) =>
        !catalogueCommands.has(commandWords) &&
        !processCommands.includes(commandWords),
    );

    expect([...new Set(unmappedCommands)]).toEqual([]);
  });
});

/** Every Markdown page of the user guide. */
function listGuidePages(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(
    (directoryEntry) => {
      const entryPath = join(directoryPath, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        return listGuidePages(entryPath);
      }

      return directoryEntry.name.endsWith(".md") ? [entryPath] : [];
    },
  );
}

describe("the user guide and the surface catalogue", () => {
  const guideText = listGuidePages(resolve(process.cwd(), "../docs/wiki"))
    .map((guidePage) => readFileSync(guidePage, "utf8"))
    .join("\n");

  test("WS-06.5 every MCP tool named in the user guide runs an operation", () => {
    const guideTools = new Set(
      [...guideText.matchAll(/\bsendmock_[a-z_]+\b/g)]
        .map((toolMatch) => toolMatch[0])
        // `sendmock_payment_*` and `_step_*` name a family of tools.
        .filter((toolName) => !toolName.endsWith("_")),
    );

    expect(
      [...guideTools].filter((toolName) => !catalogueTools.has(toolName)),
    ).toEqual([]);
  });

  test("WS-06.5 every CLI command named in the user guide runs an operation", () => {
    const inlineCommands = [...guideText.matchAll(/`(sendmock [^`]+)`/g)].map(
      (commandMatch) => commandMatch[1] ?? "",
    );
    const blockCommands = [...guideText.matchAll(/```[\s\S]*?```/g)].flatMap(
      (blockMatch) =>
        (blockMatch[0] ?? "")
          .split("\n")
          .filter((blockLine) => blockLine.startsWith("sendmock ")),
    );
    const unmappedCommands = [...inlineCommands, ...blockCommands]
      .filter(
        (commandText) =>
          !isCatalogueCommand(commandText) &&
          !processCommands.includes(readCommandWords(commandText)),
      )
      .map(readCommandWords);

    expect([...new Set(unmappedCommands)]).toEqual([]);
  });
});

type SpecOperation = {
  operationId: string;
  "x-sendmock-cli": string;
  "x-sendmock-mcp": string | null;
};

/** `POST /api/v1/emails/{emailId}/simulate` to its operation in the spec. */
function readSpecOperations(): Map<string, SpecOperation> {
  const spec = parseYaml(
    readFileSync(resolve(process.cwd(), "../docs/api/openapi.yaml"), "utf8"),
  ) as { paths: Record<string, Record<string, SpecOperation>> };

  return new Map(
    Object.entries(spec.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem).map(([method, operation]) => [
        `${method.toUpperCase()} ${path}`,
        operation,
      ]),
    ),
  );
}

type ReferenceEntry = {
  slug?: string;
  name?: string;
  area_slug: string;
  operations?: { method: string; path: string }[];
  operation?: { method: string; path: string };
};

/** `POST /api/v1/emails/{emailId}/simulate` to its CLI and MCP reference pages (WS-07.4). */
function readReferenceUrls(): Map<string, { cliUrl: string; mcpUrl: string }> {
  const readReference = (fileName: string) =>
    JSON.parse(
      readFileSync(resolve(process.cwd(), "../docs/api", fileName), "utf8"),
    ) as Record<string, ReferenceEntry[]>;
  const cliReference = readReference("cli-reference.json");
  const mcpReference = readReference("mcp-tools.json");
  const urlsByOperation = (
    entries: ReferenceEntry[],
    section: string,
    readAnchor: (entry: ReferenceEntry) => string,
  ) =>
    new Map(
      entries.flatMap((entry) =>
        (entry.operations ?? (entry.operation ? [entry.operation] : [])).map(
          (operation): [string, string] => [
            `${operation.method} ${operation.path}`,
            `/${section}/${entry.area_slug}/#${readAnchor(entry)}`,
          ],
        ),
      ),
    );
  const cliUrls = urlsByOperation(
    cliReference.commands ?? [],
    "cli",
    (entry) => entry.slug ?? "",
  );
  const mcpUrls = new Map([
    ...urlsByOperation(
      mcpReference.tools ?? [],
      "mcp",
      (entry) => entry.name ?? "",
    ),
    ...urlsByOperation(
      mcpReference.resources ?? [],
      "mcp",
      (entry) => entry.slug ?? "",
    ),
  ]);

  return new Map(
    [...cliUrls].map(([operationKey, cliUrl]) => [
      operationKey,
      { cliUrl, mcpUrl: mcpUrls.get(operationKey) ?? "" },
    ]),
  );
}

/** `| label | cli | api | mcp |` to its four cells. */
function readTableCells(tableRow: string): string[] {
  return tableRow
    .replace(/^\| /, "")
    .replace(/ \|$/, "")
    .split(" | ")
    .map((tableCell) => tableCell.trim());
}

test("UI-11.4 WS-07.4 every CLI, API and AI row is complete, links each name to its reference entry and uses the catalogue's names", () => {
  const specOperations = readSpecOperations();
  const referenceUrls = readReferenceUrls();
  const wikiDirectory = resolve(process.cwd(), "../docs/wiki");
  const problems: string[] = [];
  for (const guidePage of listGuidePages(wikiDirectory)) {
    const pageText = readFileSync(guidePage, "utf8");
    const sectionStart = pageText.indexOf("## From the CLI, API and AI");
    if (sectionStart === -1) {
      continue;
    }
    const tableRows = pageText
      .slice(sectionStart)
      .split("\n")
      .filter((tableLine) => /^\| (?!Do this|---)/.test(tableLine));
    for (const tableRow of tableRows) {
      const [label, cliCell, apiCell, mcpCell] = readTableCells(tableRow);
      const rowName = `${guidePage.replace(wikiDirectory, "")}: ${label}`;
      const apiMatch =
        /^\[`([A-Z]+) ([^`]+)`\]\(\/api\/([a-z-]+)\/#(\w+)\)$/.exec(
          apiCell ?? "",
        );
      const operation =
        apiMatch === null
          ? undefined
          : specOperations.get(`${apiMatch[1]} ${apiMatch[2]}`);
      if (operation === undefined || apiMatch?.[4] !== operation.operationId) {
        problems.push(`${rowName}: the API cell does not link an operation`);
        continue;
      }
      const operationUrls = referenceUrls.get(`${apiMatch[1]} ${apiMatch[2]}`);
      const expectedCli = `[\`${operation["x-sendmock-cli"]}\`](${operationUrls?.cliUrl})`;
      if (cliCell !== expectedCli) {
        problems.push(`${rowName}: CLI should be ${expectedCli}`);
      }
      const expectedMcp =
        operation["x-sendmock-mcp"] === null
          ? "none: agents never read secrets"
          : `[\`${operation["x-sendmock-mcp"]}\`](${operationUrls?.mcpUrl})`;
      if (mcpCell !== expectedMcp) {
        problems.push(`${rowName}: MCP should be ${expectedMcp}`);
      }
    }
  }

  expect(problems).toEqual([]);
});
