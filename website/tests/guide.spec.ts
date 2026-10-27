import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const wikiDirectory = fileURLToPath(
  new URL("../../docs/wiki", import.meta.url),
);
const webSourceDirectory = fileURLToPath(
  new URL("../../web/src/features", import.meta.url),
);

/**
 * The user guide page for every sidebar path (docs/plan/19-user-guide.md).
 * A sidebar item without an entry here fails WS-06.1, so a new menu cannot
 * ship without its page.
 */
const guidePageByMenuPath: Record<string, string> = {
  "/": "overview.md",
  "/mail": "mail/index.md",
  "/mail/providers": "mail/providers.md",
  "/sms": "sms/index.md",
  "/sms/verify": "sms/verify.md",
  "/sms/providers": "sms/providers.md",
  "/http": "http/index.md",
  "/webhooks/overview": "webhooks/index.md",
  "/webhooks/endpoints": "webhooks/endpoints.md",
  "/webhooks/rules": "webhooks/rules.md",
  "/webhooks/inbound-routes": "webhooks/inbound-routes.md",
  "/webhooks/deliveries": "webhooks/deliveries.md",
  "/webhooks/composer": "webhooks/composer-and-saved.md",
  "/webhooks/templates": "webhooks/templates.md",
  "/webhooks/variables": "webhooks/variables.md",
  "/webhooks/saved": "webhooks/composer-and-saved.md",
  "/payments": "payments/index.md",
  "/payments/gateways": "payments/gateways.md",
  "/payments/methods": "payments/methods.md",
  "/payments/flows": "payments/flows.md",
  "/numbers": "numbers.md",
  "/scenarios": "scenarios.md",
  "/logs": "logs.md",
  "/settings": "settings.md",
};

const templateHeadings = [
  "What it solves",
  "How it connects",
  "Use it",
  "Everything on this screen",
  "Customize",
  "From the CLI, API and AI",
];

/** Sidebar paths, read from the single list the sidebar is built from. */
function readSidebarPaths(): string[] {
  const navigationSource = readFileSync(
    join(webSourceDirectory, "navigation/navigation-items.ts"),
    "utf8",
  );

  return [...navigationSource.matchAll(/path: "([^"]+)"/g)].map(
    (pathMatch) => pathMatch[1] ?? "",
  );
}

function readSettingsSectionLabels(): string[] {
  const sectionsSource = readFileSync(
    join(webSourceDirectory, "settings/settings-sections.ts"),
    "utf8",
  );

  return [
    ...sectionsSource.matchAll(/sectionId: "[^"]+", label: "([^"]+)"/g),
  ].map((labelMatch) => labelMatch[1] ?? "");
}

function readWikiPage(wikiPagePath: string): string {
  return readFileSync(join(wikiDirectory, wikiPagePath), "utf8");
}

function listHeadings(wikiPagePath: string, headingLevel: number): string[] {
  const pageWithoutCode = readWikiPage(wikiPagePath).replace(
    /```[\s\S]*?```/g,
    "",
  );
  const headingPattern = new RegExp(`^#{${headingLevel}} (.+)$`, "gm");

  return [...pageWithoutCode.matchAll(headingPattern)].map(
    (headingMatch) => headingMatch[1]?.trim() ?? "",
  );
}

/** Wiki paths (relative to docs/wiki) of every Markdown page this page links to. */
function listLinkedPages(wikiPagePath: string): Set<string> {
  const linkTargets = [
    ...readWikiPage(wikiPagePath).matchAll(/\]\(([^)#\s]+\.md)(#[^)]*)?\)/g),
  ].map((linkMatch) => linkMatch[1] ?? "");

  return new Set(
    linkTargets.map((linkTarget) =>
      normalize(join(dirname(wikiPagePath), linkTarget)),
    ),
  );
}

function listImageTargets(wikiPagePath: string): string[] {
  return [
    ...readWikiPage(wikiPagePath).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g),
  ].map((imageMatch) =>
    normalize(join(dirname(wikiPagePath), imageMatch[1] ?? "")),
  );
}

function listFolderPages(folderName: string): string[] {
  return readdirSync(join(wikiDirectory, folderName))
    .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
    .map((fileName) => `${folderName}/${fileName}`);
}

const menuPages = [...new Set(Object.values(guidePageByMenuPath))];

test("WS-06.1 every sidebar item has a guide page with the template headings", () => {
  const sidebarPaths = readSidebarPaths();
  expect(sidebarPaths.length).toBeGreaterThan(15);

  const problems: string[] = [];
  for (const sidebarPath of sidebarPaths) {
    const guidePage = guidePageByMenuPath[sidebarPath];
    if (guidePage === undefined) {
      problems.push(`${sidebarPath} has no guide page`);
      continue;
    }
    if (!existsSync(join(wikiDirectory, guidePage))) {
      problems.push(`${guidePage} does not exist`);
      continue;
    }
    const pageHeadings = listHeadings(guidePage, 2);
    for (const templateHeading of templateHeadings) {
      if (!pageHeadings.includes(templateHeading)) {
        problems.push(`${guidePage} has no "## ${templateHeading}"`);
      }
    }
  }

  expect(problems).toEqual([]);
});

test("WS-06.1 every Settings section has its own part of the Settings page", () => {
  const sectionLabels = readSettingsSectionLabels();
  expect(sectionLabels.length).toBeGreaterThan(5);

  const settingsHeadings = listHeadings("settings.md", 3);
  const missingSections = sectionLabels.filter(
    (sectionLabel) => !settingsHeadings.includes(sectionLabel),
  );

  expect(missingSections).toEqual([]);
});

test("WS-06.2 every menu page shows a screenshot that exists", () => {
  const problems: string[] = [];
  for (const menuPage of menuPages) {
    const imageTargets = listImageTargets(menuPage);
    if (imageTargets.length === 0) {
      problems.push(`${menuPage} has no screenshot`);
    }
    for (const imageTarget of imageTargets) {
      if (!existsSync(join(wikiDirectory, imageTarget))) {
        problems.push(`${menuPage} shows a missing ${imageTarget}`);
      }
    }
  }

  expect(problems).toEqual([]);
});

test("WS-06.3 the connection map and the problem index link to every menu page", () => {
  for (const guidePage of ["how-it-connects.md", "use-cases.md"]) {
    const linkedPages = listLinkedPages(guidePage);
    const unlinkedMenuPages = menuPages.filter(
      (menuPage) => !linkedPages.has(menuPage),
    );

    expect(unlinkedMenuPages, guidePage).toEqual([]);
  }
});

test("WS-06.3 every recipe and Advanced page is linked from a menu page", () => {
  const menuFolderPages = [
    "mail",
    "sms",
    "http",
    "webhooks",
    "payments",
  ].flatMap((folderName) => listFolderPages(folderName));
  const linkedFromMenus = new Set(
    [...menuPages, ...menuFolderPages].flatMap((menuPage) => [
      ...listLinkedPages(menuPage),
    ]),
  );
  const unlinkedPages = [
    ...listFolderPages("recipes"),
    ...listFolderPages("advanced"),
  ].filter((guidePage) => !linkedFromMenus.has(guidePage));

  expect(unlinkedPages).toEqual([]);
});
