import { chromium } from "@playwright/test";
const outDir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
await page.goto("http://localhost:5173/payments/gateways");
await page.getByTestId("payment-gateway-row").first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/gw-table.png` });
await page.getByRole("button", { name: "Edit SSLCommerz" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/gw-general.png` });
for (const tab of ["Checkout", "Merchant", "Redirect", "Notification"]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/gw-${tab.toLowerCase()}.png` });
}
await page.getByRole("tab", { name: "Reference" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/gw-reference.png` });
await browser.close();
