import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { installPlatforms } from "../components/landing/install-platforms";

const wikiDirectory = join(import.meta.dir, "../../docs/wiki");

/** The anchor the docs site gives a heading: lower case, punctuation dropped, words hyphenated. */
function toHeadingAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function readHeadingAnchors(wikiPagePath: string): string[] {
  const pageText = readFileSync(
    join(wikiDirectory, `${wikiPagePath}.md`),
    "utf8",
  );
  return [...pageText.matchAll(/^#{2,4} (.+)$/gm)].map((headingMatch) =>
    toHeadingAnchor(headingMatch[1] ?? ""),
  );
}

describe("the quick start's links to the install docs", () => {
  test("WS-02.1 every tab links its other ways to install, and every link reaches a real page and heading", () => {
    for (const installPlatform of installPlatforms) {
      expect(
        installPlatform.docsLinks.length,
        installPlatform.key,
      ).toBeGreaterThan(0);
      for (const docsLink of installPlatform.docsLinks) {
        const [pagePath = "", anchor] = docsLink.docsPath
          .replace(/^\/docs\//, "")
          .split("#");
        expect(
          existsSync(join(wikiDirectory, `${pagePath}.md`)),
          docsLink.docsPath,
        ).toBe(true);
        if (anchor !== undefined) {
          expect(readHeadingAnchors(pagePath), docsLink.docsPath).toContain(
            anchor,
          );
        }
      }
    }
  });

  test("WS-02.1 the Docker tab links Compose, Kubernetes, the Docker Desktop extension and the Docker guide", () => {
    const dockerPlatform = installPlatforms.find(
      (installPlatform) => installPlatform.key === "docker",
    );

    expect(dockerPlatform?.docsLinks.map((docsLink) => docsLink.label)).toEqual(
      [
        "Docker Compose",
        "Kubernetes (Helm)",
        "Docker Desktop extension",
        "Docker guide",
      ],
    );
  });
});
