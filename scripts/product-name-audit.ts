/**
 * The product name audit: no tracked file may use a rejected candidate name, an owner
 * placeholder or a wrong casing of SendMock. The naming decision itself
 * (docs/plan/10-open-questions.md) lists the rejected names, so it is the one exception.
 *
 *     bun scripts/product-name-audit.ts
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type NameProblem = {
  filePath: string;
  lineNumber: number;
  found: string;
};

const rejectedCandidateNames = [
  "Gateway Lab",
  "GatewayLab",
  "MailSMS",
  "Mail SMS",
  "Sendlab",
  "Outbox Lab",
  "SMSHook",
  "SendMockway",
  "Telvara",
  "Heraldyn",
  "Msgvane",
  "Missivio",
  "Missivr",
  "Hootpit",
  "Hookwick",
  "Gatepit",
  "Mockway",
  "Sandport",
  "Pigeonix",
];

/** Wrong anywhere: `g` so every match on a line is reported. */
const forbiddenEverywhere: RegExp[] = [
  new RegExp(`\\b(?:${rejectedCandidateNames.join("|")})\\b`, "gi"),
  /<(?:owner|repo|org)>/g,
];

/**
 * SendMock in prose; code follows its language's naming (`SENDMOCK` constants, the
 * `X-Sendmock-File-Url` header), so other casings are checked in Markdown text only.
 */
const wrongProseCasing =
  /\b(?:Sendmock|SendMOCK|SENDMOCK|sendMock|Send Mock)\b/g;

/** Markdown with code blocks and inline code blanked, keeping the line numbers. */
function readMarkdownProse(markdownText: string): string {
  return markdownText
    .replace(/```[\s\S]*?```/g, (codeBlock) => codeBlock.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (inlineCode) => " ".repeat(inlineCode.length));
}

function findMatches(
  filePath: string,
  fileText: string,
  patterns: RegExp[],
): NameProblem[] {
  return fileText.split("\n").flatMap((line, lineIndex) =>
    patterns.flatMap((pattern) =>
      [...line.matchAll(pattern)].map((patternMatch) => ({
        filePath,
        lineNumber: lineIndex + 1,
        found: patternMatch[0],
      })),
    ),
  );
}

const allowedFiles = new Set([
  "docs/plan/10-open-questions.md",
  "scripts/product-name-audit.ts",
  "scripts/product-name-audit.test.ts",
]);

const binaryExtensions =
  /\.(?:png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|mp4|webm|wav|mp3|zip|gz|pdf|eml|db)$/i;

export function findNameProblems(
  filePath: string,
  fileText: string,
): NameProblem[] {
  const proseProblems = filePath.endsWith(".md")
    ? findMatches(filePath, readMarkdownProse(fileText), [wrongProseCasing])
    : [];
  return [
    ...findMatches(filePath, fileText, forbiddenEverywhere),
    ...proseProblems,
  ];
}

export function listAuditedFiles(): string[] {
  return execSync("git ls-files", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(
      (filePath) =>
        filePath !== "" &&
        !allowedFiles.has(filePath) &&
        !binaryExtensions.test(filePath),
    );
}

export function auditProductName(): NameProblem[] {
  return listAuditedFiles().flatMap((filePath) => {
    const fileText = readFileSync(filePath, "utf8");
    if (fileText.includes("\u0000")) {
      return [];
    }
    return findNameProblems(filePath, fileText);
  });
}

if (import.meta.main) {
  const nameProblems = auditProductName();
  for (const nameProblem of nameProblems) {
    console.log(
      `${nameProblem.filePath}:${nameProblem.lineNumber} ${nameProblem.found}`,
    );
  }
  console.log(
    nameProblems.length === 0
      ? "No product name problems."
      : `${nameProblems.length} problems.`,
  );
  process.exit(nameProblems.length === 0 ? 0 : 1);
}
