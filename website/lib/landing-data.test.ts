import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import { allEmulatedProviderNames, testedLanguageNames } from "./landing-data";

function readWikiPage(pagePath: string): string {
  return readFileSync(
    new URL(`../../docs/wiki/${pagePath}`, import.meta.url),
    "utf8",
  );
}

/** The first column of every table row, without the header and divider rows. */
function listTableRowNames(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---"))
    .map((line) => line.split("|")[1]?.trim() ?? "")
    .filter((rowName) => rowName !== "Provider");
}

describe("the landing page numbers match the lists they link to", () => {
  test("WS-02.1 the providers page lists exactly the providers the landing page counts", () => {
    const providerRowNames = listTableRowNames(readWikiPage("providers.md"));

    expect(providerRowNames.toSorted()).toEqual(
      [...allEmulatedProviderNames].toSorted(),
    );
  });

  test("WS-02.1 Connect your app links a guide for every language the landing page counts", () => {
    const connectIndex = readWikiPage("connect/index.md");

    for (const languageName of testedLanguageNames) {
      expect(connectIndex).toContain(languageName);
    }
  });
});
