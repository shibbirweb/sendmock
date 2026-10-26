import { expect, test } from "@playwright/test";

test("WS-08.4 code examples are tabs that work with the keyboard and remember the language across pages", async ({
  page,
}) => {
  await page.goto("/docs/recipes/read-a-code/");
  const languageTabs = page.getByRole("tablist").first();
  await expect(languageTabs.getByRole("tab")).toHaveText([
    "CLI",
    "PHP",
    "JavaScript",
    "Python",
    "Go",
    "Java",
    "Rust",
    "Ruby",
    "C#",
  ]);
  await expect(languageTabs.getByRole("tab", { name: "CLI" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await languageTabs.getByRole("tab", { name: "CLI" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(languageTabs.getByRole("tab", { name: "PHP" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel").first()).toContainText(
    "it('signs up with the emailed code'",
  );

  await languageTabs.getByRole("tab", { name: "Python" }).click();
  await page.goto("/docs/recipes/stripe-payment/");
  const stripeTabs = page.getByRole("tablist").first();
  await expect(stripeTabs.getByRole("tab", { name: "Python" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel").first()).toContainText(
    "def test_pays_with_a_test_card():",
  );
});
