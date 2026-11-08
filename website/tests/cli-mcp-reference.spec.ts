import { expect, type Page, test } from "@playwright/test";

import { readCliReference, readMcpReference } from "./support/read-references";

/** The area pages a reference index links to, e.g. `/cli/email`. */
async function listAreaPaths(page: Page, section: string): Promise<string[]> {
  await page.goto(`/${section}/`);
  const areaPaths = await page
    .locator(`main h2 a[href^='/${section}/']`)
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );

  return [...new Set(areaPaths)];
}

test("WS-07.2 every CLI command has its usage, arguments and flags, an example, output and links", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const cliReference = readCliReference();
  let commandCount = 0;
  for (const areaPath of await listAreaPaths(page, "cli")) {
    await page.goto(areaPath);
    const commandEntries = page.getByTestId("cli-command");
    const entryCount = await commandEntries.count();
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      const commandEntry = commandEntries.nth(entryIndex);
      await expect(commandEntry.getByLabel("Usage"), areaPath).toContainText(
        "sendmock ",
      );
      await expect(commandEntry.getByTestId("cli-example")).toContainText(
        "sendmock ",
      );
      await expect(commandEntry).toContainText("Output with --json");
      await expect(
        commandEntry.getByRole("link", { name: "Exit codes" }),
      ).toHaveAttribute("href", "/cli/#exit-codes");
      const otherWays = commandEntry.getByLabel("Other ways");
      await expect(otherWays.locator("a[href^='/api/']").first()).toBeVisible();
      await expect(otherWays).toContainText("In the app");
    }
    commandCount += entryCount;
  }
  expect(commandCount).toBe(cliReference.commands.length);

  await page.goto("/cli/");
  const globalFlags = page.getByRole("region", { name: "Global flags" });
  for (const globalFlag of cliReference.global_flags) {
    await expect(globalFlags).toContainText(globalFlag.flag);
  }
  const exitCodes = page.getByRole("region", { name: "Exit codes" });
  for (const exitCode of cliReference.exit_codes) {
    await expect(exitCodes).toContainText(exitCode.meaning);
  }

  await page.goto("/cli/email/");
  const updateEntry = page.locator("#email-update");
  await expect(
    updateEntry.getByRole("table", {
      name: "Arguments of sendmock email update",
    }),
  ).toContainText("<emailId>");
  const updateOtherWays = updateEntry.getByLabel("Other ways");
  await expect(
    updateOtherWays.locator("a[href^='/mcp/']").first(),
  ).toBeVisible();
  await expect(updateOtherWays).toContainText(
    "Mail > open email > Mark as read, tags",
  );
  const flagsTable = updateEntry.getByRole("table", {
    name: "Flags of sendmock email update",
  });
  await expect(flagsTable).toContainText("--read");
  await expect(flagsTable).toContainText("--tag <tag>");
  await expect(flagsTable).toContainText("repeat for more");
  await expect(updateEntry.getByTestId("cli-example")).toHaveText(
    "sendmock email update 01JB7T9Q2R5W8X3Y6Z1A4B7C9D --read --tag signup --tag qa",
  );
  await expect(page.locator("#email-simulate")).toContainText(
    "One of: delivered, deferred, bounced",
  );
});

test("WS-07.3 every MCP tool and resource has its inputs, hints, an example call, the result and links", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const mcpReference = readMcpReference();
  let toolCount = 0;
  let resourceCount = 0;
  for (const areaPath of await listAreaPaths(page, "mcp")) {
    await page.goto(areaPath);
    const toolEntries = page.getByTestId("mcp-tool");
    const entryCount = await toolEntries.count();
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      const toolEntry = toolEntries.nth(entryIndex);
      await expect(
        toolEntry.getByTestId("mcp-example"),
        areaPath,
      ).toContainText('"name": "sendmock_');
      await expect(toolEntry).toContainText("Toolset");
      await expect(toolEntry).toContainText("Result: ");
      const otherWays = toolEntry.getByLabel("Other ways");
      await expect(otherWays.locator("a[href^='/api/']").first()).toBeVisible();
      await expect(otherWays).toContainText("In the app");
    }
    toolCount += entryCount;
    resourceCount += await page.getByTestId("mcp-resource").count();
  }
  expect(toolCount).toBe(mcpReference.tools.length);
  expect(resourceCount).toBe(mcpReference.resources.length);

  await page.goto("/mcp/email/");
  const checkEntry = page.locator("#sendmock_email_check");
  const inputsTable = checkEntry.getByRole("table", {
    name: "Inputs of sendmock_email_check",
  });
  await expect(inputsTable).toContainText("kind");
  await expect(inputsTable).toContainText(
    "One of: html, unsubscribe, links, spam",
  );
  await expect(checkEntry.getByLabel("Annotations")).toHaveText("Read only");
  await expect(checkEntry).toContainText(
    "Result: HtmlCheckReport | ListUnsubscribeReport",
  );
  await expect(
    checkEntry.getByLabel("Other ways").getByTestId("operation-selector"),
  ).toHaveText([
    "kind: html",
    "kind: unsubscribe",
    "kind: links",
    "kind: spam",
  ]);
  const checkOtherWays = checkEntry.getByLabel("Other ways");
  await expect(
    checkOtherWays.locator("a[href^='/cli/']").first(),
  ).toBeVisible();
  await expect(checkOtherWays).toContainText("Mail > open email > Checks");
  await expect(
    page.locator("#sendmock_email_delete").getByLabel("Annotations"),
  ).toContainText("Destructive");

  await page.goto("/mcp/");
  await expect(
    page.getByText("Agents may set secrets but never read them back"),
  ).toBeVisible();
});

/** Every `/cli`, `/mcp` and `/api` link on these pages leads to a page with that anchor. */
async function findBrokenReferenceLinks(
  page: Page,
  pagePaths: string[],
): Promise<string[]> {
  const anchorIdsByPath = new Map<string, Set<string>>();
  const brokenLinks: string[] = [];
  for (const pagePath of pagePaths) {
    await page.goto(pagePath);
    const linkTargets = await page
      .locator(
        "main a[href^='/cli/'], main a[href^='/mcp/'], main a[href^='/api/']",
      )
      .evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
      );
    for (const linkTarget of new Set(linkTargets)) {
      const [targetPath = "", targetAnchor] = linkTarget.split("#");
      if (!anchorIdsByPath.has(targetPath)) {
        const targetHtml = await (await page.request.get(targetPath)).text();
        anchorIdsByPath.set(
          targetPath,
          new Set(
            [...targetHtml.matchAll(/ id="([^"]+)"/g)].map(
              (idMatch) => idMatch[1] ?? "",
            ),
          ),
        );
      }
      if (
        targetAnchor !== undefined &&
        !anchorIdsByPath.get(targetPath)?.has(targetAnchor)
      ) {
        brokenLinks.push(`${pagePath} links to a missing ${linkTarget}`);
      }
    }
  }

  return brokenLinks;
}

test("WS-07.4 the API, CLI and MCP references link each other to entries that exist", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/api/email/");
  const updateOperation = page.locator("#patchEmailsByEmailId");
  await expect(
    updateOperation.getByRole("link", {
      name: "sendmock email update <emailId>",
    }),
  ).toHaveAttribute("href", "/cli/email/#email-update");
  await expect(
    updateOperation.getByRole("link", { name: "sendmock_email_update" }),
  ).toHaveAttribute("href", "/mcp/email/#sendmock_email_update");

  await page.goto("/api/");
  const apiPaths = await page
    .locator("main h2 a[href^='/api/']")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
  const pagePaths = [
    ...apiPaths,
    ...(await listAreaPaths(page, "cli")),
    ...(await listAreaPaths(page, "mcp")),
    "/mcp/",
    "/docs/cli/",
    "/docs/ai/",
  ];

  expect(await findBrokenReferenceLinks(page, pagePaths)).toEqual([]);
});
