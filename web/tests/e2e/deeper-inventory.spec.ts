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
  type DeeperScreen,
  deeperScreens,
} from "../deeper/deeper-screens";
import { buildInventory } from "../deeper/inventory-builder";
import {
  type DeeperInventory,
  describeControl,
  inventoryFilePath,
  renderInventoryFile,
} from "../deeper/inventory-file";
import { navigateInApp } from "./support/app-screens";

const screenContent = (page: Page) => page.locator("#main-content");
const appHeader = (page: Page) => page.locator("main header").first();
/** The parts of the header that belong to the screen, not to the shell. */
const isScreenHeaderControl = (control: string) =>
  control.startsWith("heading: ") || /^link: Read the .* guide$/.test(control);

async function readControls(
  scope: Locator,
  isRecordingParagraphs: boolean,
): Promise<string[]> {
  return buildInventory(parseAriaSnapshot(await scope.ariaSnapshot()), {
    isRecordingParagraphs,
  }).map(describeControl);
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

async function crawlInventory(browser: Browser): Promise<DeeperInventory> {
  const normal = await readAllScreens(browser, "normal");
  const screenInventories = deeperScreens.map((deeperScreen) => ({
    path: deeperScreen.path,
    states: {
      normal: normal.screenStates.get(deeperScreen.path) ?? [],
    } as Record<string, string[]>,
  }));
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
