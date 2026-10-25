import { expect, test } from "@playwright/test";

const threadList = "section[aria-label='Conversation list']";
const conversation = "section[aria-label='Conversation']";

test.beforeEach(async ({ page }) => {
  await page.goto("/sms");
  await expect(
    page.locator(threadList).getByRole("link").first(),
  ).toBeVisible();
});

test("SM-06.3 each bubble shows its segment count and encoding", async ({
  page,
}) => {
  await page.locator(threadList).getByText("+8801711111111").click();

  await expect(
    page.locator(conversation).getByText(/\d segments?, UCS-2/),
  ).toBeVisible();
});

test("SM-11.1 WhatsApp conversations get the WhatsApp badge and bubbles", async ({
  page,
}) => {
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  const whatsappThreads = page.locator(threadList).getByRole("link");
  await expect(whatsappThreads).toHaveCount(1);

  await whatsappThreads.first().click();
  await expect(
    page
      .locator(conversation)
      .locator("[data-sms-direction='outbound']")
      .first(),
  ).toHaveClass(/bg-whatsapp-outbound/);
});

test("SM-09.1 the composer adds an inbound reply to the conversation", async ({
  page,
}) => {
  await page.locator(threadList).getByText("+447700900123").click();
  const composer = page.getByLabel("Reply as +447700900123");

  await composer.fill("Can I change it to Friday?");
  await composer.press("Enter");

  await expect(
    page
      .locator(conversation)
      .locator("[data-sms-direction='inbound']")
      .filter({ hasText: "Can I change it to Friday?" }),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
});

test("SM-10.1 a delivered message scrolled into view shows the read tick", async ({
  page,
}) => {
  await page.locator(threadList).getByText("+14155550123").click();

  await expect(
    page.locator(conversation).locator("[data-sms-status='read']"),
  ).toBeVisible();
});

test("SM-10.3 simulate read fires even on a failed message", async ({
  page,
}) => {
  await page.locator(threadList).getByText("+15005550104").click();
  const failedTick = page
    .locator(conversation)
    .locator("[data-sms-status='failed']");
  await expect(failedTick).toHaveAttribute(
    "aria-label",
    "Failed: 30008 Unknown error",
  );

  await page.getByRole("button", { name: "Message actions" }).first().click();
  await page.getByRole("menuitem", { name: "Simulate read" }).click();

  await expect(page.getByText("Read event fired")).toBeVisible();
  await expect(failedTick).toBeVisible();
});

test("J opens the next conversation and / focuses the search box", async ({
  page,
}) => {
  await page.keyboard.press("j");
  await expect(page).toHaveURL(/\/sms\/.+/);
  await expect(
    page.locator(threadList).locator("a[aria-current='page']"),
  ).toHaveCount(1);

  await page.keyboard.press("/");
  await expect(page.getByLabel("Search conversations")).toBeFocused();
});
