import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dir, "..");
const routerSource = readFileSync(
  join(repositoryRoot, "crates/sendmock-api/src/mailpit_routes.rs"),
  "utf8",
);
const guidePage = readFileSync(
  join(repositoryRoot, "docs/wiki/mail/coming-from-mailpit.md"),
  "utf8",
);

/** `/api/v1/message/{message_id}` and `/api/v1/message/{ID}` both become `/api/v1/message/{}`. */
function normalizePath(path: string): string {
  return path.replace(/\{[^}]+\}/g, "{}").replace(/\?.*$/, "");
}

const servedPaths = [...routerSource.matchAll(/\.route\(\s*"([^"]+)"/g)].map(
  (routeMatch) => normalizePath(routeMatch[1] ?? ""),
);
const documentedPaths = [...guidePage.matchAll(/`(?:GET|PUT|DELETE) (\/[^`]+)`/g)].map(
  (pathMatch) => normalizePath(pathMatch[1] ?? ""),
);

describe("Coming from Mailpit", () => {
  test("EM-19.6 the guide lists every Mailpit path SendMock serves", () => {
    const viewPaths = documentedPaths.filter((path) => path.startsWith("/view/"));

    expect(servedPaths.length).toBeGreaterThan(5);
    for (const servedPath of servedPaths) {
      const isDocumented =
        servedPath === "/view/{}"
          ? viewPaths.length === 2
          : documentedPaths.includes(servedPath);
      expect({ servedPath, isDocumented }).toEqual({ servedPath, isDocumented: true });
    }
  });

  test("EM-19.6 the guide names the endpoints whose shape differs and what is not emulated", () => {
    expect(guidePage).toContain("`GET /api/v1/info` and `POST /api/v1/send`");
    expect(guidePage).toContain("**Not emulated:**");
  });
});
