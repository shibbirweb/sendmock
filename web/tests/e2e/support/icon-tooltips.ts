import { expect, type Locator } from "@playwright/test";

/**
 * Buttons, links and toggle items; the sidebar rail is an invisible drag
 * handle, not an icon.
 */
const controlSelector = [
  'button:not([role]):not([data-sidebar="rail"])',
  'button[role="radio"]',
  "a[href]",
].join(", ");

/** The name a reader hears: `aria-label`, else the text (such as an sr-only span). */
async function readAccessibleName(control: Locator): Promise<string> {
  return control.evaluate(
    (element) =>
      element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
  );
}

async function findIconOnlyControls(scope: Locator): Promise<Locator[]> {
  const controls = scope.locator(controlSelector);
  const iconOnlyControls: Locator[] = [];
  for (
    let controlIndex = 0;
    controlIndex < (await controls.count());
    controlIndex += 1
  ) {
    const control = controls.nth(controlIndex);
    const isShown = (await control.isVisible()) && (await control.isEnabled());
    if (isShown && (await control.innerText()).trim() === "") {
      iconOnlyControls.push(control);
    }
  }

  return iconOnlyControls;
}

/**
 * Hovers each icon-only control in the scope and expects a tooltip that starts
 * with its accessible name (UI-13.1). Failures are soft, so one crawl reports
 * every control without a tooltip.
 */
export async function expectIconTooltips(scope: Locator, stateName: string) {
  const page = scope.page();
  const missingTooltips: string[] = [];
  for (const control of await findIconOnlyControls(scope)) {
    const accessibleName = await readAccessibleName(control);
    await control.hover();
    const tooltip = page.getByRole("tooltip");
    const tooltipText = await tooltip
      .first()
      .textContent({ timeout: 1_500 })
      .catch(() => null);
    if (
      tooltipText === null ||
      !tooltipText.startsWith(accessibleName) ||
      accessibleName === ""
    ) {
      missingTooltips.push(
        `${accessibleName || "(no name)"}: ${tooltipText ?? "no tooltip"}`,
      );
    }
    // Radix closes a tooltip on a pointer move after the one that left its
    // trigger, so a single jump away leaves it open.
    await expect(async () => {
      await page.mouse.move(1, 1);
      await page.mouse.move(0, 0);
      await expect(tooltip).toHaveCount(0, { timeout: 250 });
    }).toPass();
  }
  expect
    .soft(
      missingTooltips,
      `icon-only controls without a matching tooltip in ${stateName}`,
    )
    .toEqual([]);
}
