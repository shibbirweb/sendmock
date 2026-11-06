import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

/** Traffic sent to SendMock before the agent starts, as the app would send it. */
export type BeforeRequest = {
  path: string;
  json?: unknown;
  form?: Record<string, string>;
};

/** One API read after the run: some item of the answer must have these field values. */
export type EndStateCheck = { path: string; fields: Record<string, unknown> };

export type CaseSetup = { before: BeforeRequest[]; checks: EndStateCheck[] };

export type MarkdownFile = {
  name: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

export type EvalCase = {
  name: string;
  directory: string;
  prompt: MarkdownFile;
  graders: MarkdownFile[];
  seedPath: string | null;
  setup: CaseSetup;
};

/** The file beside `claude plugin eval`'s own files that holds SendMock's part of a case. */
export const caseSetupFileName = "sendmock-eval.json";
export const caseSeedFileName = "seed.toml";

export function parseMarkdownFile(
  name: string,
  markdown: string,
): MarkdownFile {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(markdown);
  if (frontmatterMatch === null) {
    return { name, frontmatter: {}, body: markdown.trim() };
  }
  const frontmatter = (Bun.YAML.parse(frontmatterMatch[1] ?? "") ??
    {}) as Record<string, unknown>;
  return { name, frontmatter, body: (frontmatterMatch[2] ?? "").trim() };
}

export function parseCaseSetup(setupJson: string | null): CaseSetup {
  if (setupJson === null) {
    return { before: [], checks: [] };
  }
  const setup = JSON.parse(setupJson) as Partial<CaseSetup>;
  return { before: setup.before ?? [], checks: setup.checks ?? [] };
}

function readOptionalText(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
}

export function readEvalCase(directory: string): EvalCase {
  const graderDirectory = join(directory, "graders");
  const graderNames = existsSync(graderDirectory)
    ? readdirSync(graderDirectory).filter((fileName) =>
        fileName.endsWith(".md"),
      )
    : [];
  const seedPath = join(directory, caseSeedFileName);
  return {
    name: basename(directory),
    directory,
    prompt: parseMarkdownFile(
      "prompt.md",
      readFileSync(join(directory, "prompt.md"), "utf8"),
    ),
    graders: graderNames
      .sort()
      .map((fileName) =>
        parseMarkdownFile(
          fileName.replace(/\.md$/, ""),
          readFileSync(join(graderDirectory, fileName), "utf8"),
        ),
      ),
    seedPath: existsSync(seedPath) ? seedPath : null,
    setup: parseCaseSetup(readOptionalText(join(directory, caseSetupFileName))),
  };
}

/** Every case directory (one holding a `prompt.md`) under the plugin's eval directory. */
export function listEvalCases(evalsDirectory: string): EvalCase[] {
  return readdirSync(evalsDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(evalsDirectory, entry.name, "prompt.md")),
    )
    .map((entry) => readEvalCase(join(evalsDirectory, entry.name)))
    .sort((first, second) => first.name.localeCompare(second.name));
}
