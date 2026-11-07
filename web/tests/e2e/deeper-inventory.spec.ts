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
  type DeeperInventory,
  describeControl,
  type ScreenInventory,
  inventoryFilePath,
  renderInventoryFile,
} from "../deeper/inventory-file";
import { navigateInApp } from "./support/app-screens";

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

async function chooseDataState(page: Page, dataState: DeeperDataState) {
  const dataStateChoice = dataStateChoices[dataState];
  await page.getByRole("button", { name: "Demo controls" }).click();
  const liveTraffic = page.getByRole("switch", { name: /Live traffic/ });
  if ((await liveTraffic.getAttribute("aria-checked")) === "true") {
    await liveTraffic.click();
  }
  await page.getByRole("combobox").first().click();
  await page
    .getByRole("option", { name: dataStateChoice.apiResponses, exact: true })
    .click();
  await page.getByRole("combobox").nth(1).click();
  await page
    .getByRole("option", { name: dataStateChoice.dataSet, exact: true })
    .click();
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
  return [
    ...headerControls,
    ...(await readControls(screenContent(page), true)),
  ];
}

/** Each data state in a fresh page, so no screen shows data cached from another state. */
async function readAllScreens(
  browser: Browser,
  dataState: DeeperDataState,
): Promise<{ shellControls: string[]; screenStates: Map<string, string[]> }> {
  const page = await browser.newPage();
  await page.goto("/");
  await chooseDataState(page, dataState);
  const shellControls = [
    ...new Set([
      ...(await readControls(page.locator('[data-sidebar="sidebar"]'), false)),
      ...(await readControls(appHeader(page), false)).filter(
        (control) => !isScreenHeaderControl(control),
      ),
    ]),
  ];
  const screenStates = new Map<string, string[]>();
  for (const deeperScreen of deeperScreens) {
    if (
      dataState === "normal" ||
      deeperScreen.extraDataStates.includes(dataState)
    ) {
      screenStates.set(
        deeperScreen.path,
        await readScreenState(page, deeperScreen, dataState),
      );
    }
  }
  await page.close();
  return { shellControls, screenStates };
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

async function crawlInventory(browser: Browser): Promise<DeeperInventory> {
  const normal = await readAllScreens(browser, "normal");
  const screenInventories: ScreenInventory[] = [];
  for (const deeperScreen of deeperScreens) {
    const normalControls = normal.screenStates.get(deeperScreen.path) ?? [];
    screenInventories.push({
      path: deeperScreen.path,
      states: Object.fromEntries([
        ["normal", normalControls],
        ...(await readOverlays(browser, deeperScreen, normalControls)),
      ]),
    });
  }
  for (const dataState of ["empty", "failing"] as const) {
    const extraState = await readAllScreens(browser, dataState);
    for (const screenInventory of screenInventories) {
      const stateControls = extraState.screenStates.get(screenInventory.path);
      if (stateControls !== undefined) {
        const normalControls = new Set(screenInventory.states.normal);
        screenInventory.states[dataState] = stateControls.filter(
          (control) => !normalControls.has(control),
        );
      }
    }
  }
  return { shell: normal.shellControls, screens: screenInventories };
}

test("WS-10.3 the Deeper inventory lists every control and text of every screen of the demo", async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  const freshInventory = renderInventoryFile(await crawlInventory(browser));
  if (process.env.DEEPER_UPDATE === "1") {
    mkdirSync(dirname(inventoryFilePath), { recursive: true });
    writeFileSync(inventoryFilePath, freshInventory);
    return;
  }
  const committedInventory = existsSync(inventoryFilePath)
    ? readFileSync(inventoryFilePath, "utf8")
    : "";
  if (committedInventory !== freshInventory) {
    await testInfo.attach("inventory.json", {
      body: freshInventory,
      contentType: "application/json",
    });
  }
  expect(
    committedInventory,
    "A screen changed: run DEEPER_UPDATE=1 bun --bun playwright test deeper-inventory, or take inventory.json from the report, then update its Deeper entries",
  ).toBe(freshInventory);
});
