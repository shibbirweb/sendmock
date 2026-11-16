import { expect, test } from "@playwright/test";

import { loadChangelog } from "../lib/changelog/load-changelog";
import { unreleasedVersion } from "../lib/changelog/parse-changelog";

// The page is built from the repository's CHANGELOG.md, which changes with every release, so the
// expectations come from the same file instead of from a fixed release state.
test("DS-05.4 the changelog page shows every section of CHANGELOG.md, newest first", async ({
  page,
}) => {
  const changelogReleases = loadChangelog();
  const hasStableRelease = changelogReleases.some(
    (changelogRelease) => changelogRelease.version !== unreleasedVersion,
  );

  await page.goto("/changelog/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  const releaseSections = page.getByTestId("changelog-release");
  await expect(releaseSections).toHaveCount(changelogReleases.length);
  for (const [releaseIndex, changelogRelease] of changelogReleases.entries()) {
    const releaseSection = releaseSections.nth(releaseIndex);
    await expect(
      releaseSection.getByRole("heading", { level: 2 }),
    ).toContainText(
      changelogRelease.version === unreleasedVersion
        ? `${unreleasedVersion} in the newest beta`
        : `${changelogRelease.version} ${changelogRelease.releaseDate}`,
    );
    await expect(releaseSection.getByRole("listitem").first()).toBeVisible();
  }
  // The Markdown of an entry is formatted, not shown as asterisks.
  await expect(releaseSections.locator("strong").first()).toBeVisible();
  await expect(releaseSections.first()).not.toContainText("**");
  if (hasStableRelease) {
    await expect(page.getByTestId("changelog-empty")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("changelog-empty")).toContainText(
      "No stable release yet",
    );
  }
});

test("the footer's What's new link opens the changelog", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "What's new" })
    .click();

  await expect(page).toHaveURL(/\/changelog\/?$/);
});
