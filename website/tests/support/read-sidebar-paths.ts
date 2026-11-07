import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The web app's navigation list, the single list the sidebar is built from. */
export function readNavigationSource(): string {
  return readFileSync(
    fileURLToPath(
      new URL(
        "../../../web/src/features/navigation/navigation-items.ts",
        import.meta.url,
      ),
    ),
    "utf8",
  );
}

/** Every sidebar path, such as `/mail` or `/webhooks/rules`. */
export function readSidebarPaths(): string[] {
  return [...readNavigationSource().matchAll(/path: "([^"]+)"/g)].map(
    (pathMatch) => pathMatch[1] ?? "",
  );
}
