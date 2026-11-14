import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Every Markdown page under the docs folder, in a stable order. */
function listDocsFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath)
    .sort()
    .flatMap((entryName) => {
      const entryPath = join(directoryPath, entryName);
      if (statSync(entryPath).isDirectory()) {
        return entryName === "images" ? [] : listDocsFiles(entryPath);
      }
      return entryName.endsWith(".md") ? [entryPath] : [];
    });
}

/** The page without its frontmatter, and its title from it. */
function readDocsPage(filePath: string): { title: string; body: string } {
  const pageText = readFileSync(filePath, "utf8");
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(pageText);
  const title =
    /^title:\s*(.+)$/m.exec(frontmatterMatch?.[1] ?? "")?.[1]?.trim() ??
    filePath;

  return {
    title,
    body: pageText.slice(frontmatterMatch?.[0].length ?? 0).trim(),
  };
}

/**
 * /llms-full.txt for this docs version (AI-06.1): /llms.txt, then every docs
 * page in full, so an agent can read the whole guide in one request.
 */
export function buildLlmsFullText(
  llmsText: string,
  docsDirectory: string,
): string {
  const pageSections = listDocsFiles(docsDirectory).map((filePath) => {
    const docsPage = readDocsPage(filePath);
    const pagePath = relative(docsDirectory, filePath);

    return `# ${docsPage.title} (${pagePath})\n\n${docsPage.body}`;
  });

  return [llmsText.trim(), ...pageSections].join("\n\n---\n\n") + "\n";
}
