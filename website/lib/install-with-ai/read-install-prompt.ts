import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The "Install with AI" prompt from docs/wiki/install.md (WS-09), the one
 * source for the docs pages, /llms.txt and the landing card.
 */
export function extractInstallPrompt(installPage: string): string | null {
  const sectionStart = installPage.indexOf("## Install with AI");
  if (sectionStart === -1) {
    return null;
  }

  const promptMatch = /\n( *)```text\n([\s\S]*?)\n\1```/.exec(
    installPage.slice(sectionStart),
  );
  if (promptMatch === null) {
    return null;
  }

  const indentation = promptMatch[1] ?? "";

  return (promptMatch[2] ?? "")
    .split("\n")
    .map((promptLine) =>
      promptLine.startsWith(indentation)
        ? promptLine.slice(indentation.length)
        : promptLine,
    )
    .join("\n");
}

/** Null for a docs version built from a tag that has no prompt yet. */
export function readInstallPrompt(): string | null {
  try {
    return extractInstallPrompt(
      readFileSync(join(process.cwd(), "../docs/wiki/install.md"), "utf8"),
    );
  } catch {
    return null;
  }
}
