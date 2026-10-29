import { expect, type Page, test } from "@playwright/test";

import { countSpecOperations } from "./support/count-spec-operations";

/** Scrolls the whole page so every in-view animation gets its chance to run. */
async function scrollThroughPage(page: Page) {
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let scrollTop = 0; scrollTop < pageHeight; scrollTop += 500) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
  }
}

test("WS-02.1 the landing page has the hero, flow, quick start, marquee, bento grid and number ticker", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Catch every email, SMS, payment and webhook",
  );
  await expect(
    page.getByRole("link", { name: "Try the live demo" }).first(),
  ).toBeVisible();
  const flowDiagram = page.getByTestId("flow-diagram");
  await expect(flowDiagram).toContainText("SendMock");
  await expect(flowDiagram.locator("svg path").first()).toBeAttached();
  await expect(page.getByTestId("works-with-marquee")).toContainText("Twilio");
  await expect(page.getByTestId("quick-start-terminal")).toBeVisible();
  await expect(page.getByTestId("features-bento")).toContainText("Payments");
  await expect(page.getByTestId("number-ticker")).toHaveCount(3);
  await expect(
    page.getByRole("tablist", { name: "Product screens" }).getByRole("tab"),
  ).toHaveCount(4);
});

const releaseUrl =
  "https://github.com/shibbirweb/sendmock/releases/latest/download";
const visitorUserAgents = {
  macOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  Windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

test.describe("the quick start on a Mac", () => {
  test.use({ userAgent: visitorUserAgents.macOS });

  test("WS-02.1 the quick start shows the install command for each operating system", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const platformTabs = page.getByRole("tablist", {
      name: "Your platform",
    });
    const terminal = page.getByTestId("quick-start-terminal");

    await expect(platformTabs.getByRole("tab")).toHaveText([
      "macOS",
      "Windows",
      "Linux",
      "Docker",
      "AI",
    ]);
    await expect(
      platformTabs.getByRole("tab", { name: "macOS" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(terminal).toContainText(
      "$ brew install shibbirweb/tap/sendmock",
    );

    await platformTabs.getByRole("tab", { name: "Windows" }).click();
    await expect(terminal).toContainText(
      `PS> irm ${releaseUrl}/install.ps1 | iex`,
    );
    await expect(terminal).toContainText("PS> sendmock");

    await page.keyboard.press("ArrowRight");
    await expect(
      platformTabs.getByRole("tab", { name: "Linux" }),
    ).toBeFocused();
    await expect(terminal).toContainText(
      `$ curl -fsSL ${releaseUrl}/install.sh | sh`,
    );
    await expect(terminal).not.toContainText("otp");
  });

  test("WS-02.1 the quick start keeps one height on every platform tab", async ({
    page,
  }) => {
    await page.goto("/");
    const platformTabs = page.getByRole("tablist", { name: "Your platform" });
    const panel = page
      .getByRole("region", { name: "Install and run" })
      .getByRole("tabpanel");
    const panelHeights: number[] = [];

    for (const platformLabel of ["macOS", "Windows", "Linux", "Docker", "AI"]) {
      await platformTabs.getByRole("tab", { name: platformLabel }).click();
      const panelBox = await panel.boundingBox();
      panelHeights.push(panelBox?.height ?? 0);
    }

    expect(panelHeights[0]).toBeGreaterThan(0);
    expect(new Set(panelHeights).size).toBe(1);
  });

  test("WS-02.1 the platform tabs and the copy button show the pointer cursor", async ({
    page,
  }) => {
    await page.goto("/");
    const linuxTab = page
      .getByRole("tablist", { name: "Your platform" })
      .getByRole("tab", { name: "Linux" });
    const copyButton = page
      .getByTestId("quick-start-terminal")
      .getByRole("button", { name: "Copy the install command" });

    await expect(linuxTab).toHaveCSS("cursor", "pointer");
    await expect(copyButton).toHaveCSS("cursor", "pointer");
  });

  test("WS-02.1 the Docker tab pulls and runs the image, with no binary downloads", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const terminal = page.getByTestId("quick-start-terminal");

    await page
      .getByRole("tablist", { name: "Your platform" })
      .getByRole("tab", { name: "Docker" })
      .click();

    await expect(terminal).toContainText(
      "$ docker pull ghcr.io/shibbirweb/sendmock",
    );
    await expect(terminal).toContainText(
      "$ docker run --rm -p 1025:1025 -p 8025:8025 ghcr.io/shibbirweb/sendmock",
    );
    await expect(terminal).toContainText("SMTP listening on 0.0.0.0:1025");
    await expect(page.getByTestId("quick-start-downloads")).toHaveCount(0);
  });
});

test.describe("the quick start downloads on a Mac", () => {
  test.use({ userAgent: visitorUserAgents.macOS });

  test("WS-02.1 the quick start links the release archives for the chosen system", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const downloads = page.getByTestId("quick-start-downloads");

    await expect(downloads).toContainText("Or download the macOS binary:");
    await expect(
      downloads.getByRole("link", { name: "Apple silicon" }),
    ).toHaveAttribute(
      "href",
      `${releaseUrl}/sendmock-aarch64-apple-darwin.tar.gz`,
    );
    await expect(
      downloads.getByRole("link", { name: "Intel" }),
    ).toHaveAttribute(
      "href",
      `${releaseUrl}/sendmock-x86_64-apple-darwin.tar.gz`,
    );

    await page
      .getByRole("tablist", { name: "Your platform" })
      .getByRole("tab", { name: "Windows" })
      .click();
    await expect(downloads).toContainText("Or download the Windows binary:");
    await expect(downloads.getByRole("link", { name: "x64" })).toHaveAttribute(
      "href",
      `${releaseUrl}/sendmock-x86_64-pc-windows-msvc.zip`,
    );
    await expect(
      downloads.getByRole("link", { name: "All files and checksums" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/shibbirweb/sendmock/releases/latest",
    );
  });
});

test.describe("the quick start on Windows", () => {
  test.use({ userAgent: visitorUserAgents.Windows });

  test("WS-02.1 the quick start opens on the visitor's operating system", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page
        .getByRole("tablist", { name: "Your platform" })
        .getByRole("tab", { name: "Windows" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("quick-start-terminal")).toContainText(
      `PS> irm ${releaseUrl}/install.ps1 | iex`,
    );
  });

  test("WS-02.1 the copy button copies the install command without its prompt", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await page
      .getByTestId("quick-start-terminal")
      .getByRole("button", { name: "Copy the install command" })
      .click();

    await expect(
      page.getByTestId("quick-start-terminal").getByRole("button", {
        name: "Copied",
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `irm ${releaseUrl}/install.ps1 | iex`,
    );
  });
});

test("WS-02.1 every main section has a label, a title and a line of text in one style", async ({
  page,
}) => {
  await page.goto("/");
  const sectionHeadings = [
    ["How it works", "Point your app at SendMock"],
    ["Quick start", "Install and run"],
    ["Screenshots", "See what your app sent"],
    ["Features", "Everything in one place"],
    ["Why SendMock", "Stop testing on real inboxes and phones"],
  ];
  const headingStyles = new Set<string>();

  for (const [eyebrow, title] of sectionHeadings) {
    const section = page.getByRole("region", { name: title });
    const heading = section.getByRole("heading", { level: 2, name: title });

    await expect(heading).toBeVisible();
    await expect(section.getByText(eyebrow, { exact: true })).toBeVisible();
    headingStyles.add(
      await heading.evaluate((element) => {
        const style = getComputedStyle(element);

        return `${style.fontSize} ${style.fontWeight} ${style.letterSpacing}`;
      }),
    );
  }

  expect([...headingStyles]).toHaveLength(1);
});

test("WS-09.4 the quick start's AI tab shows an agent window with the whole prompt, copies it and links agents to llms.txt", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const aiPrompt = page.getByTestId("quick-start-ai-prompt");

  // The whole prompt is in the HTML, open tab or not, so an agent reading the page finds it.
  await expect(aiPrompt).toBeHidden();
  await expect(page.getByTestId("quick-start-ai-full-prompt")).toContainText(
    "Before you install anything, check this computer",
  );

  await page
    .getByRole("tablist", { name: "Your platform" })
    .getByRole("tab", { name: "AI" })
    .click();
  await expect(aiPrompt).toBeVisible();
  await expect(page.getByTestId("quick-start-terminal")).toHaveCount(0);
  // First the whole prompt to read; with reduced motion it waits for the reader.
  await expect(page.getByTestId("quick-start-ai-prompt-text")).toContainText(
    "Before you install anything, check this computer",
  );
  await page.getByRole("button", { name: "Show the agent run" }).click();
  // Then an agent's window, not a plain terminal: your whole prompt, its question, the result.
  const conversation = page.getByTestId("quick-start-ai-conversation");
  await expect(aiPrompt).toContainText("AI coding agent");
  await expect(conversation).toContainText(
    "Before you install anything, check this computer",
  );
  await expect(conversation).toContainText("Docker or the binary?");
  await expect(conversation).toContainText("Run command");
  await expect(conversation).toContainText("SendMock is running");
  await expect(
    aiPrompt.getByRole("button", { name: "Copy the install prompt" }),
  ).toBeVisible();
  const aiLinks = page.getByTestId("quick-start-ai-links");
  await expect(
    aiLinks.getByRole("link", { name: "llms.txt for AI agents" }),
  ).toHaveAttribute("href", "/llms.txt");
  await expect(
    aiLinks.getByRole("link", { name: "Step by step" }),
  ).toHaveAttribute("href", "/docs/install/#install-with-ai");
  await expect(
    page.locator('head link[rel="alternate"][type="text/plain"]'),
  ).toHaveAttribute("href", "/llms.txt");
});

test("WS-09.4 the AI tab shows the prompt, copies it, then opens the agent window", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("tablist", { name: "Your platform" })
    .getByRole("tab", { name: "AI" })
    .click();

  await expect(page.getByTestId("quick-start-ai-prompt-text")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Copied to clipboard", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("quick-start-ai-conversation")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("quick-start-ai-prompt-text")).toHaveCount(0);
  // Your messages are pasted or typed into the message box before they are sent.
  const messageBox = page.getByTestId("quick-start-ai-composer");
  await expect(messageBox).toContainText("Pasted text", { timeout: 5_000 });
  await expect(messageBox).toContainText("The binary", { timeout: 15_000 });
  await expect(page.getByTestId("quick-start-ai-conversation")).toContainText(
    "The binary, stable",
    { timeout: 5_000 },
  );
});

test("WS-02.1 the stack marquee fades out at both edges", async ({ page }) => {
  await page.goto("/");
  const maskImage = await page
    .getByTestId("works-with-marquee")
    .evaluate((marqueeElement) => getComputedStyle(marqueeElement).maskImage);
  // Chrome reports `to right` as 90deg and `transparent` as rgba(0, 0, 0, 0).
  const toRight = "(?:to right|90deg)";
  const clear = "(?:transparent|rgba\\(0, 0, 0, 0\\))";

  expect(maskImage).toMatch(
    new RegExp(`^linear-gradient\\(${toRight}, ${clear}, .+, ${clear}\\)$`),
  );
});

test("WS-02.1 the number ticker counts the providers, languages and API operations it shows", async ({
  page,
}) => {
  await page.goto("/");
  await scrollThroughPage(page);

  await expect(page.getByTestId("number-ticker")).toHaveText([
    "15",
    "8",
    String(countSpecOperations()),
  ]);
});

test("WS-02.1 the product screens switch with the tabs and the arrow keys", async ({
  page,
}) => {
  await page.goto("/");
  const screenTabs = page.getByRole("tablist", { name: "Product screens" });
  const screenPanel = page.getByRole("tabpanel");

  await screenTabs.getByRole("tab", { name: "SMS" }).click();
  await expect(screenPanel.getByRole("img").first()).toHaveAttribute(
    "alt",
    /The SMS screen/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(screenTabs.getByRole("tab", { name: "Webhooks" })).toBeFocused();
  await expect(
    screenTabs.getByRole("tab", { name: "Webhooks" }),
  ).toHaveAttribute("aria-selected", "true");
});

test("WS-02.1 each number links to the list it counts", async ({ page }) => {
  await page.goto("/");
  const numbers = page.getByRole("region", { name: "SendMock in numbers" });

  await expect(
    numbers.getByRole("link", { name: /built-in provider APIs/ }),
  ).toHaveAttribute("href", "/docs/providers/");
  await expect(
    numbers.getByRole("link", { name: /languages with connection guides/ }),
  ).toHaveAttribute("href", "/docs/connect/");
  await expect(
    numbers.getByRole("link", { name: /REST API operations/ }),
  ).toHaveAttribute("href", "/api/");
});

test("WS-02.1 every feature card links to its own docs page", async ({
  page,
}) => {
  await page.goto("/");
  const featuresBento = page.getByTestId("features-bento");

  for (const docsPath of [
    "/docs/mail",
    "/docs/sms",
    "/docs/webhooks",
    "/docs/payments",
    "/docs/http",
    "/docs/ai",
  ]) {
    await expect(
      featuresBento.locator(`a[href="${docsPath}"]`).first(),
    ).toBeAttached();
  }
});

test("WS-02.2 with reduced motion every animation is static and the page stays readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // The quick start shows every line at once instead of typing it.
  const terminal = page.getByTestId("quick-start-terminal");
  // Playwright's desktop Chrome reports Windows, so its tab (PS>) may open first.
  await expect(terminal).toContainText(/(\$|PS>) sendmock/);
  await expect(terminal).toContainText(
    "Web UI and API on http://127.0.0.1:8025",
  );
  // The tickers show their final values without counting.
  await expect(page.getByTestId("number-ticker")).toHaveText([
    "15",
    "8",
    String(countSpecOperations()),
  ]);
  // The feature cards' SMS list shows every message at once.
  const featuresBento = page.getByTestId("features-bento");
  await expect(featuresBento).toContainText("Your verification code is 482913");
  await expect(featuresBento).toContainText("Your order is on its way");
  // The beams are drawn as plain paths, with no moving gradient.
  await expect(
    page.getByTestId("flow-diagram").locator("path[stroke^='url(']"),
  ).toHaveCount(0);
  // CSS animations (marquee, shimmer, shiny text) finish at once.
  const runningAnimationCount = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          animation.playState === "running" &&
          (timing?.duration ?? 0) !== 0 &&
          Number(timing?.duration) > 1
        );
      }).length,
  );
  expect(runningAnimationCount).toBe(0);
});

test("WS-02.4 the promotional video shows its poster, the three benefits and a play button", async ({
  page,
}) => {
  await page.goto("/");
  const promoVideo = page.getByRole("region", {
    name: "Stop testing on real inboxes and phones",
  });

  await expect(promoVideo.getByTestId("promo-video-poster")).toBeVisible();
  await expect(
    promoVideo.getByRole("button", { name: "Play the video" }),
  ).toBeEnabled();
  await expect(
    promoVideo
      .getByRole("list", { name: "Why developers use SendMock" })
      .getByRole("heading"),
  ).toHaveText([
    "No real messages sent",
    "Seconds, not minutes",
    "One setting to switch",
  ]);
});

test("WS-02.4 the promotional video loads no third-party player before play is pressed", async ({
  page,
}) => {
  const thirdPartyRequests: string[] = [];
  page.on("request", (request) => {
    const requestHost = new URL(request.url()).hostname;
    if (/youtube|ytimg|googlevideo/.test(requestHost)) {
      thirdPartyRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page
    .getByRole("region", { name: "Stop testing on real inboxes and phones" })
    .scrollIntoViewIfNeeded();

  expect(thirdPartyRequests).toEqual([]);
});

test("WS-02.4 pressing play loads the YouTube player in place of the poster", async ({
  page,
}) => {
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<html></html>" }),
  );
  await page.goto("/");
  const promoVideo = page.getByRole("region", {
    name: "Stop testing on real inboxes and phones",
  });

  await promoVideo.getByRole("button", { name: "Play the video" }).click();

  await expect(promoVideo.getByTestId("promo-video-poster")).toHaveCount(0);
  await expect(
    promoVideo.getByTestId("promo-video-player").locator("iframe"),
  ).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/OHR7pVFGTl4?autoplay=1&rel=0",
  );
});

test("the footer and header link to docs, feedback forms, security and the repository", async ({
  page,
}) => {
  await page.goto("/");
  const footerNav = page.getByRole("navigation", { name: "Footer" });

  await expect(
    footerNav.getByRole("link", { name: "Report an issue" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/shibbirweb/sendmock/issues/new?template=bug_report.yml",
  );
  await expect(
    footerNav.getByRole("link", { name: "Report a security issue" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/shibbirweb/sendmock/security/advisories/new",
  );
  await expect(
    footerNav.getByRole("link", { name: "Star on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/shibbirweb/sendmock");
  await expect(footerNav.getByRole("heading")).toHaveText([
    "Product",
    "Get started",
    "Community",
  ]);
  await expect(footerNav.getByRole("link", { name: "Docker" })).toHaveAttribute(
    "href",
    "/docs/connect/docker/",
  );
  await expect(
    page.getByRole("link", { name: /SendMock on GitHub/ }).first(),
  ).toBeVisible();
});
