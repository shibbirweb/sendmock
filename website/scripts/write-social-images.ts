/**
 * Renders the 1200x630 link preview images (Open Graph and Twitter cards) into
 * public/social/: one for the landing page, one for the docs and references.
 * Run `bun run social-images` after changing the wording or the logo, and
 * commit the PNGs.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

type SocialCard = {
  fileName: string;
  eyebrow: string;
  headline: string;
  footer: string;
};

const socialCards: SocialCard[] = [
  {
    fileName: "sendmock.png",
    eyebrow: "Free and open source",
    headline: "Catch every email, SMS, payment and webhook on your machine",
    footer: "One binary · Linux, macOS, Windows, Docker",
  },
  {
    fileName: "sendmock-docs.png",
    eyebrow: "SendMock docs",
    headline: "Guides, API, CLI and MCP reference",
    footer: "Local sandbox for email, SMS, payments and webhooks",
  },
];

const outputDirectory = fileURLToPath(
  new URL("../public/social", import.meta.url),
);
const logoSvg = readFileSync(
  fileURLToPath(new URL("../app/icon.svg", import.meta.url)),
  "utf8",
);
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSocialCardHtml(socialCard: SocialCard): string {
  return `<!doctype html>
<html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background:
          radial-gradient(640px 420px at 88% 18%, rgba(16, 185, 129, 0.22), transparent 70%),
          radial-gradient(520px 360px at 6% 100%, rgba(13, 148, 136, 0.18), transparent 70%),
          #0d1117;
        color: #e6edf3;
        font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 72px 80px;
      }
      .brand { display: flex; align-items: center; gap: 20px; }
      .brand img { width: 72px; height: 72px; }
      .brand span { font-size: 40px; font-weight: 700; letter-spacing: -0.01em; }
      .eyebrow { color: #34d399; font-size: 28px; font-weight: 600; margin-bottom: 20px; }
      h1 { font-size: 68px; line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; max-width: 1000px; }
      .footer { color: #8b949e; font-size: 28px; }
    </style>
  </head>
  <body>
    <div class="brand"><img src="${logoDataUrl}" alt="" /><span>SendMock</span></div>
    <div>
      <p class="eyebrow">${escapeHtml(socialCard.eyebrow)}</p>
      <h1>${escapeHtml(socialCard.headline)}</h1>
    </div>
    <p class="footer">${escapeHtml(socialCard.footer)}</p>
  </body>
</html>`;
}

mkdirSync(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const socialCard of socialCards) {
  await page.setContent(renderSocialCardHtml(socialCard));
  await page.screenshot({
    path: `${outputDirectory}/${socialCard.fileName}`,
    type: "png",
  });
  console.log(`Wrote public/social/${socialCard.fileName}`);
}
await browser.close();
