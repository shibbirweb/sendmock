import { expect, test, type Page } from "@playwright/test";

const threadList = "section[aria-label='Conversation list']";
const conversation = "section[aria-label='Conversation']";

/** 1x1 transparent PNG. */
const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function openSmsScreen(page: Page) {
  await page.goto("/sms");
  await expect(
    page.locator(threadList).getByRole("link").first(),
  ).toBeVisible();
}

test("SM-15.4 MMS bubbles show image thumbnails, file chips and a badge", async ({
  page,
}) => {
  await openSmsScreen(page);
  await page.locator(threadList).getByText("+447700900123").click();
  const conversationPanel = page.locator(conversation);

  const qrImage = conversationPanel.getByRole("img", {
    name: "booking-qr.png",
  });
  await expect(qrImage).toBeVisible();
  await expect
    .poll(() =>
      qrImage.evaluate(
        (imageElement: HTMLImageElement) => imageElement.naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await expect(
    conversationPanel.getByRole("link", { name: /booking\.pdf/ }),
  ).toBeVisible();
  await expect(
    conversationPanel.getByText("MMS", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Message actions" }).last().click();
  await page.getByRole("menuitem", { name: "Message details" }).click();
  const mediaList = page.getByRole("region", { name: "Message media" });
  await expect(mediaList).toContainText("Media (2)");
  await expect(mediaList).toContainText("application/pdf");
});

test("SM-15.4 WhatsApp media gets the Media badge", async ({ page }) => {
  await openSmsScreen(page);
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  await page.locator(threadList).getByRole("link").first().click();

  await expect(
    page.locator(conversation).getByRole("img", { name: "gate.jpg" }),
  ).toBeVisible();
  await expect(
    page.locator(conversation).getByText("Media", { exact: true }),
  ).toBeVisible();
});

test("SM-15.5 Reply as recipient can attach files", async ({ page }) => {
  await openSmsScreen(page);
  await page.locator(threadList).getByText("+61400000000").click();

  await page.getByLabel("Choose files to attach").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(tinyPngBase64, "base64"),
  });
  const pendingFiles = page.getByRole("list", { name: "Files to send" });
  await expect(pendingFiles).toContainText("receipt.png");

  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.locator(conversation).getByRole("img", { name: "receipt.png" }),
  ).toBeVisible();
  await expect(pendingFiles).toHaveCount(0);
});

test("SM-15.5 the composer refuses more than 10 files", async ({ page }) => {
  await openSmsScreen(page);
  await page.locator(threadList).getByText("+61400000000").click();

  await page.getByLabel("Choose files to attach").setInputFiles(
    Array.from({ length: 11 }, (_, fileIndex) => ({
      name: `photo-${fileIndex}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(tinyPngBase64, "base64"),
    })),
  );
  await expect(page.getByText("Attach at most 10 files")).toBeVisible();
});

test("SM-15.2 SM-15.3 native sends store URL and inline media, and bad media is refused", async ({
  page,
}) => {
  await openSmsScreen(page);
  const sendResults = await page.evaluate(async (pngBase64) => {
    const postSms = (smsRequest: unknown) =>
      fetch("/api/v1/sms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(smsRequest),
      });
    const acceptedResponse = await postSms({
      from: "+15550001111",
      to: "+15550009876",
      body: "Your parcel photo",
      media_urls: ["https://cdn.example.com/photos/parcel.jpg"],
      media: [{ filename: "label.png", content: pngBase64 }],
    });
    const acceptedMessage = (await acceptedResponse.json()) as { id: string };
    const mediaResponse = await fetch(
      `/api/v1/sms/${acceptedMessage.id}/media/1`,
    );
    const rejectedResponse = await postSms({
      from: "+15550001111",
      to: "+15550009876",
      body: "Broken",
      media: [{ filename: "photo.jpg", content: "not base64!" }],
    });

    return {
      acceptedStatus: acceptedResponse.status,
      mediaContentType: mediaResponse.headers.get("content-type"),
      rejectedStatus: rejectedResponse.status,
      rejectedMessage: (
        (await rejectedResponse.json()) as { error: { message: string } }
      ).error.message,
    };
  }, tinyPngBase64);

  expect(sendResults).toEqual({
    acceptedStatus: 201,
    mediaContentType: "image/png",
    rejectedStatus: 400,
    rejectedMessage: "media[0].content is not valid base64",
  });

  await page.locator(threadList).getByText("+15550009876").click();
  await expect(
    page.locator(conversation).getByRole("img", { name: "parcel.jpg" }),
  ).toBeVisible();
  await expect(
    page.locator(conversation).getByRole("img", { name: "label.png" }),
  ).toBeVisible();
});

test("PL-05.9 the SMS body offers media and media_urls chips", async ({
  page,
}) => {
  await page.goto("/settings?section=connection");
  await page.getByText("Customize the request").click();
  await page.getByRole("button", { name: "media", exact: true }).click();
  await page.getByRole("button", { name: "media_urls" }).click();

  const smsSnippet = page.getByRole("region", { name: "SMS API" });
  await expect(smsSnippet).toContainText(
    "$photoJpgContent = base64_encode(file_get_contents('photo.jpg'));",
  );
  await expect(smsSnippet).toContainText("'media_urls' => [");
});
