import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

import { watchFailedApiCalls } from "./live-api-watch";

/** Stores a raw message as an app's mailer sends it, through the SMTP ingest path. */
async function sendRawEmail(request: APIRequestContext, rawMessage: string) {
  const sendResponse = await request.post("/api/v1/send/raw", {
    headers: { "content-type": "message/rfc822" },
    data: rawMessage,
  });
  expect(sendResponse.status()).toBe(201);
  const { id: emailId } = (await sendResponse.json()) as { id: string };

  return emailId;
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

async function openEmail(page: Page, emailId: string, subject: string) {
  await page.goto(`/mail/${emailId}`);
  await expect(
    page.getByRole("heading", { level: 2, name: subject }),
  ).toBeVisible();
}

const multipartMessage = [
  "From: Shop <shop@example.test>",
  "To: sam@example.test",
  "Subject: Live MIME parts",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="outer"',
  "",
  "--outer",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Your order is attached. Verify at https://shop.test/verify?token=live42",
  "--outer",
  "Content-Type: text/plain",
  'Content-Disposition: attachment; filename="order.txt"',
  "Content-Transfer-Encoding: base64",
  "",
  "MTA=",
  "--outer--",
  "",
].join("\r\n");

test("EM-04.6 the MIME tab shows the tree and a part downloads", async ({
  page,
  request,
}) => {
  const emailId = await sendRawEmail(request, multipartMessage);
  const failedApiCalls = watchFailedApiCalls(page);
  await openEmail(page, emailId, "Live MIME parts");

  await page.getByRole("tab", { name: "MIME" }).click();
  const mimePanel = page.getByRole("tabpanel");
  await expect(mimePanel.getByText("multipart/mixed")).toBeVisible();
  await expect(mimePanel.getByText("order.txt")).toBeVisible();
  await expect(mimePanel.getByText(/base64/)).toBeVisible();
  await expect(mimePanel.getByText(/utf-8/)).toBeVisible();
  const partDownload = page.waitForEvent("download");
  await mimePanel.getByRole("link", { name: "Download part 1.2" }).click();

  expect((await partDownload).suggestedFilename()).toBe("order.txt");
  expect(failedApiCalls).toEqual([]);
});

test("EM-05.2 links in the email are extracted and listed", async ({
  page,
  request,
}) => {
  const emailId = await sendRawEmail(
    request,
    multipartMessage.replace("Live MIME parts", "Live links"),
  );
  await openEmail(page, emailId, "Live links");

  await expect(
    page
      .getByRole("link", { name: "https://shop.test/verify?token=live42" })
      .first(),
  ).toBeVisible();
});

test("EM-04.7 Screenshot saves a PNG of the rendered HTML", async ({
  page,
  request,
}) => {
  const emailId = await sendRawEmail(
    request,
    [
      "From: shop@example.test",
      "To: sam@example.test",
      "Subject: Live screenshot",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<h1>Order shipped</h1><p>Thanks for shopping.</p>",
      "",
    ].join("\r\n"),
  );
  await openEmail(page, emailId, "Live screenshot");

  const screenshotDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Screenshot" }).click();

  expect((await screenshotDownload).suggestedFilename()).toBe(
    "Live screenshot.png",
  );
});

const unusualMessages = [
  {
    subject: "Live broken HTML",
    headers: ["Content-Type: text/html; charset=utf-8"],
    body: "<div><p>Unclosed <b>bold text<table><tr><td>cell",
    shownText: "Unclosed",
  },
  {
    subject: "Live missing charset",
    headers: ["Content-Type: text/plain"],
    body: "Café déjà vu, without a charset",
    shownText: "without a charset",
  },
  {
    subject: "আপনার অর্ডার পাঠানো হয়েছে",
    headers: ["Content-Type: text/plain; charset=utf-8"],
    body: "ধন্যবাদ, আপনার অর্ডার আসছে।",
    shownText: "ধন্যবাদ",
  },
  {
    subject: "تم شحن طلبك",
    headers: ["Content-Type: text/plain; charset=utf-8"],
    body: "شكرا لتسوقك معنا",
    shownText: "شكرا",
  },
  {
    subject: "ご注文の商品を発送しました",
    headers: ["Content-Type: text/plain; charset=utf-8"],
    body: "ご利用ありがとうございます。",
    shownText: "ありがとうございます",
  },
];

for (const unusualMessage of unusualMessages) {
  test(`EM-04.8 renders without errors: ${unusualMessage.subject}`, async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (pageError) => {
      pageErrors.push(pageError.message);
    });
    const emailId = await sendRawEmail(
      request,
      [
        "From: shop@example.test",
        "To: sam@example.test",
        `Subject: ${encodeSubject(unusualMessage.subject)}`,
        "MIME-Version: 1.0",
        ...unusualMessage.headers,
        "",
        unusualMessage.body,
        "",
      ].join("\r\n"),
    );
    const failedApiCalls = watchFailedApiCalls(page);
    await openEmail(page, emailId, unusualMessage.subject);

    const isHtml = unusualMessage.headers[0]?.includes("text/html") ?? false;
    if (isHtml) {
      await expect(
        page.frameLocator("iframe").first().getByText(unusualMessage.shownText),
      ).toBeVisible();
    } else {
      await page.getByRole("tab", { name: "Text" }).click();
      await expect(
        page.getByRole("tabpanel").getByText(unusualMessage.shownText),
      ).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
    expect(failedApiCalls).toEqual([]);
  });
}
