import { expect, test } from "@playwright/test";

/** 1x1 transparent PNG. */
const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("EM-07.4 attachments sent to /send are stored, downloadable and shown inline", async ({
  page,
}) => {
  await page.goto("/mail");
  // The mock API answers once the list has loaded.
  await expect(
    page.locator("section[aria-label='Email list'] a").first(),
  ).toBeVisible();
  const sendResult = await page.evaluate(async (pngBase64) => {
    const response = await fetch("/api/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "app@app.test",
        to: ["user@example.com"],
        subject: "Invoice with attachments",
        html: '<p>See attached.</p><img alt="Logo" src="cid:logo">',
        attachments: [
          { filename: "invoice.pdf", content: btoa("%PDF-1.4 demo invoice") },
          { filename: "logo.png", content: pngBase64, content_id: "logo" },
        ],
      }),
    });

    return {
      status: response.status,
      body: (await response.json()) as { id: string },
    };
  }, tinyPngBase64);
  expect(sendResult.status).toBe(201);

  // A reload would rebuild the in-browser mock data, so open it from the list.
  await page
    .locator("section[aria-label='Email list']")
    .getByText("Invoice with attachments")
    .click();
  await page.getByRole("tab", { name: "Attachments (2)" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("invoice.pdf");
  await expect(page.getByRole("tabpanel")).toContainText("logo.png");

  const downloadedText = await page.evaluate(async (emailId) => {
    const response = await fetch(`/api/v1/emails/${emailId}/attachments/0`);

    return {
      contentType: response.headers.get("content-type"),
      text: await response.text(),
    };
  }, sendResult.body.id);
  expect(downloadedText).toEqual({
    contentType: "application/pdf",
    text: "%PDF-1.4 demo invoice",
  });

  await page.getByRole("tab", { name: "HTML" }).click();
  const inlineLogo = page
    .frameLocator("iframe")
    .getByRole("img", { name: "Logo" });
  await expect
    .poll(() =>
      inlineLogo.evaluate(
        (imageElement: HTMLImageElement) => imageElement.naturalWidth,
      ),
    )
    .toBe(1);
});

test("EM-07.5 invalid attachments return 400 naming the attachment", async ({
  page,
}) => {
  await page.goto("/mail");
  // The mock API answers once the list has loaded.
  await expect(
    page.locator("section[aria-label='Email list'] a").first(),
  ).toBeVisible();
  const errorResult = await page.evaluate(async () => {
    const response = await fetch("/api/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "app@app.test",
        to: ["user@example.com"],
        subject: "Broken",
        attachments: [
          { filename: "ok.txt", content: "b2s=" },
          { filename: "broken.txt", content: "not base64!" },
        ],
      }),
    });

    return { status: response.status, body: await response.json() };
  });

  expect(errorResult.status).toBe(400);
  expect(errorResult.body.error.message).toBe(
    "attachments[1].content is not valid base64",
  );
});

test("PL-05.8 the attachments chip makes each snippet read and encode the file", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  await page.getByText("Customize the request").click();
  await page.getByRole("button", { name: "attachments" }).click();

  const emailSnippet = page.getByRole("region", { name: "Email API" });
  await expect(emailSnippet).toContainText(
    "$invoicePdfContent = base64_encode(file_get_contents('invoice.pdf'));",
  );
  await expect(emailSnippet).toContainText("'content' => $invoicePdfContent,");

  await page.getByLabel("Language").click();
  await page.getByRole("option", { name: "Node.js" }).click();
  await expect(emailSnippet).toContainText(
    'const invoicePdfContent = fs.readFileSync("invoice.pdf").toString("base64");',
  );
});
