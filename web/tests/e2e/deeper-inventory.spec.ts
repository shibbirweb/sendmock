import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import { parseAriaSnapshot } from "../deeper/aria-snapshot-parser";
import {
  dataStateChoices,
  type DeeperDataState,
  type DeeperOverlay,
  type DeeperScreen,
  deeperScreens,
} from "../deeper/deeper-screens";
import { buildInventory } from "../deeper/inventory-builder";
import {
  describeControl,
  renderInventoryFile,
  toInventoryFilePath,
} from "../deeper/inventory-file";
import { navigateInApp } from "./support/app-screens";
import { expectIconTooltips } from "./support/icon-tooltips";

const screenContent = (page: Page) => page.locator("#main-content");
const appHeader = (page: Page) => page.locator("main header").first();
/** The parts of the header that belong to the screen, not to the shell. */
const isScreenHeaderControl = (control: string) =>
  control.startsWith("heading: ") || /^link: Read the .* guide$/.test(control);

async function readControlsOnce(
  scope: Locator,
  isRecordingParagraphs: boolean,
): Promise<string[]> {
  return buildInventory(parseAriaSnapshot(await scope.ariaSnapshot()), {
    isRecordingParagraphs,
  }).map(describeControl);
}

/**
 * The controls once two reads 400 ms apart agree: a refetch after a data state change can
 * land after the screen first shows, and "networkidle" does not wait for one in an app.
 */
async function readControls(
  scope: Locator,
  isRecordingParagraphs: boolean,
): Promise<string[]> {
  let previousControls = await readControlsOnce(scope, isRecordingParagraphs);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await scope.page().waitForTimeout(400);
    const currentControls = await readControlsOnce(
      scope,
      isRecordingParagraphs,
    );
    if (currentControls.join("\n") === previousControls.join("\n")) {
      return currentControls;
    }
    previousControls = currentControls;
  }
  return previousControls;
}

/** Live traffic off, and the data state's API answers and data set (a fresh page is normal). */
async function chooseDataState(page: Page, dataState: DeeperDataState) {
  const dataStateChoice = dataStateChoices[dataState];
  await page.getByRole("button", { name: "Demo controls" }).click();
  const liveTraffic = page.getByRole("switch", { name: /Live traffic/ });
  if ((await liveTraffic.getAttribute("aria-checked")) === "true") {
    await liveTraffic.click();
  }
  if (dataState !== "normal") {
    await page.getByRole("combobox").first().click();
    await page
      .getByRole("option", { name: dataStateChoice.apiResponses, exact: true })
      .click();
    await page.getByRole("combobox").nth(1).click();
    await page
      .getByRole("option", { name: dataStateChoice.dataSet, exact: true })
      .click();
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

async function readScreenState(
  page: Page,
  deeperScreen: DeeperScreen,
  dataState: DeeperDataState,
): Promise<string[]> {
  await navigateInApp(page, deeperScreen.path);
  await expect(page).toHaveTitle(new RegExp(`${deeperScreen.title}$`));
  await expect(
    screenContent(page).locator('[data-slot="skeleton"]'),
  ).toHaveCount(0);
  if (dataState === "failing") {
    await expect(screenContent(page).getByRole("alert").first()).toBeVisible();
  }
  const headerControls = (await readControls(appHeader(page), false)).filter(
    isScreenHeaderControl,
  );
  // A screen that repeats its name above the content is listed once.
  return [
    ...new Set([
      ...headerControls,
      ...(await readControls(screenContent(page), true)),
    ]),
  ];
}

/** A data state in a fresh page, so the screen shows no data cached from another state. */
async function readDataState(
  browser: Browser,
  deeperScreen: DeeperScreen,
  dataState: DeeperDataState,
): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto("/");
  await chooseDataState(page, dataState);
  const stateControls = await readScreenState(page, deeperScreen, dataState);
  if (dataState === "normal") {
    await expectIconTooltips(screenContent(page), deeperScreen.path);
  }
  await page.close();
  return stateControls;
}

function readOverlayScope(page: Page, scope: DeeperOverlay["scope"]): Locator {
  if (scope === "dialog") {
    return page.locator('[role="dialog"], [role="alertdialog"]').last();
  }
  return scope === "menu" ? page.getByRole("menu").last() : screenContent(page);
}

/**
 * Each overlay from a fresh load of its screen. A screen overlay leaves out what the screen
 * shows anyway, and any overlay leaves out its baseline's controls; one adding nothing is
 * left out.
 */
async function readOverlays(
  browser: Browser,
  deeperScreen: DeeperScreen,
  normalControls: string[],
): Promise<[string, string[]][]> {
  const page = await browser.newPage();
  const overlayStates: [string, string[]][] = [];
  const controlsByOverlay = new Map<string, string[]>();
  for (const overlay of deeperScreen.overlays) {
    await page.goto(deeperScreen.path);
    await chooseDataState(page, "normal");
    await readScreenState(page, deeperScreen, "normal");
    await overlay.open(page);
    const overlayScope = readOverlayScope(page, overlay.scope);
    await expect(overlayScope).toBeVisible();
    await expect(overlayScope.locator('[data-slot="skeleton"]')).toHaveCount(0);
    const overlayControls = await readControls(overlayScope, true);
    await expectIconTooltips(
      overlayScope,
      `${deeperScreen.path} ${overlay.name}`,
    );
    controlsByOverlay.set(overlay.name, overlayControls);
    const leftOutControls = new Set([
      ...(overlay.scope === "screen" ? normalControls : []),
      ...(controlsByOverlay.get(overlay.baseline ?? "") ?? []),
    ]);
    const newControls = overlayControls.filter(
      (control) => !leftOutControls.has(control),
    );
    if (newControls.length > 0) {
      overlayStates.push([overlay.name, newControls]);
    }
  }
  await page.close();
  return overlayStates;
}

async function crawlScreen(
  browser: Browser,
  deeperScreen: DeeperScreen,
): Promise<Record<string, string[]>> {
  const normalControls = await readDataState(browser, deeperScreen, "normal");
  const states: Record<string, string[]> = Object.fromEntries([
    ["normal", normalControls],
    ...(await readOverlays(browser, deeperScreen, normalControls)),
  ]);
  for (const dataState of deeperScreen.extraDataStates) {
    const normalSet = new Set(normalControls);
    states[dataState] = (
      await readDataState(browser, deeperScreen, dataState)
    ).filter((control) => !normalSet.has(control));
  }
  return states;
}

async function crawlShell(browser: Browser): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto("/");
  await chooseDataState(page, "normal");
  const shellControls = [
    ...new Set([
      ...(await readControls(page.locator('[data-sidebar="sidebar"]'), false)),
      ...(await readControls(appHeader(page), false)).filter(
        (control) => !isScreenHeaderControl(control),
      ),
    ]),
  ];
  await expectIconTooltips(page.locator('[data-sidebar="sidebar"]'), "sidebar");
  await expectIconTooltips(appHeader(page), "header");
  await page.close();
  return shellControls;
}

/** Compares a fresh inventory file with the committed one, or writes it when asked. */
async function checkInventoryFile(
  fileKey: string,
  freshInventory: string,
  attach: (name: string, body: string) => Promise<void>,
) {
  const inventoryFilePath = toInventoryFilePath(fileKey);
  if (process.env.DEEPER_UPDATE === "1") {
    mkdirSync(dirname(inventoryFilePath), { recursive: true });
    writeFileSync(inventoryFilePath, freshInventory);
    return;
  }
  const committedInventory = existsSync(inventoryFilePath)
    ? readFileSync(inventoryFilePath, "utf8")
    : "";
  if (committedInventory !== freshInventory) {
    await attach(`${fileKey}.json`, freshInventory);
  }
  expect(
    committedInventory,
    `${fileKey} changed: run DEEPER_UPDATE=1 bun --bun playwright test deeper-inventory, or take ${fileKey}.json from the report, then update its Deeper entries`,
  ).toBe(freshInventory);
}

const attachTo =
  (testInfo: {
    attach: (
      name: string,
      options: { body: string; contentType: string },
    ) => Promise<void>;
  }) =>
  (name: string, body: string) =>
    testInfo.attach(name, { body, contentType: "application/json" });

test("WS-10.3 UI-13.1 the Deeper inventory lists every control of the sidebar and header, each icon with its tooltip", async ({
  browser,
}, testInfo) => {
  await checkInventoryFile(
    "shell",
    renderInventoryFile({
      order: 0,
      path: "shell",
      states: { normal: await crawlShell(browser) },
    }),
    attachTo(testInfo),
  );
});

for (const [screenIndex, deeperScreen] of deeperScreens.entries()) {
  test(`WS-10.3 UI-13.1 the Deeper inventory lists every control and text of ${deeperScreen.path}, each icon with its tooltip`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    await checkInventoryFile(
      deeperScreen.path,
      renderInventoryFile({
        order: screenIndex + 1,
        path: deeperScreen.path,
        states: await crawlScreen(browser, deeperScreen),
      }),
      attachTo(testInfo),
    );
  });
}
