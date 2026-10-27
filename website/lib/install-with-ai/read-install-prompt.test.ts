import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { extractInstallPrompt } from "./read-install-prompt";

const wikiDirectory = new URL("../../../docs/wiki/", import.meta.url);

function readWikiPage(fileName: string) {
  return readFileSync(new URL(fileName, wikiDirectory), "utf8");
}

describe("extractInstallPrompt", () => {
  test("WS-09.1 Getting started repeats the Install page's prompt word for word", () => {
    const installPrompt = extractInstallPrompt(readWikiPage("install.md"));

    expect(installPrompt).not.toBeNull();
    expect(
      extractInstallPrompt(
        readWikiPage("getting-started.md").replace(
          "### Install with AI",
          "## Install with AI",
        ),
      ),
    ).toBe(installPrompt);
  });

  test("WS-09.1 every command in the prompt is one of the Install page's own commands", () => {
    const installPage = readWikiPage("install.md");
    const installPrompt = extractInstallPrompt(installPage) ?? "";
    const promptCommands = [
      ...installPrompt.matchAll(/^ {3}- [^:]+: `(.+)`$/gm),
    ].map((commandMatch) => commandMatch[1] ?? "");
    const pageOutsidePrompt = installPage.replace(installPrompt, "");

    expect(promptCommands).toHaveLength(8);
    for (const promptCommand of promptCommands) {
      expect(pageOutsidePrompt).toContain(promptCommand);
    }
  });

  test("WS-09.2 the prompt checks the computer, asks the questions, waits for an OK and ends with the addresses", () => {
    const installPrompt = (
      extractInstallPrompt(readWikiPage("install.md")) ?? ""
    ).toLowerCase();

    for (const expectedInstruction of [
      "before you install anything, check this computer",
      "whether docker is installed and running",
      "whether homebrew is installed",
      "sendmock --version",
      "docker: sendmock runs in a container",
      "the binary: one small program",
      "stable version (recommended) or the beta",
      "wait for my ok",
      "has no release yet, stop and tell me",
      "http://127.0.0.1:8025",
      "port 1025",
      "how to stop sendmock",
      "do not change any other settings",
    ]) {
      expect(installPrompt).toContain(expectedInstruction);
    }
  });

  test("a page without the section has no prompt", () => {
    expect(extractInstallPrompt("# Install\n\nNo prompt here.\n")).toBeNull();
  });
});
