import { basePath } from "@/lib/base-path";
import { currentDocsVersion } from "@/lib/current-docs-version";

/** Where the site is published; links in /llms.txt must be absolute. */
export const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shibbirweb.github.io";

export type LlmsDocsPage = {
  title: string;
  description: string | undefined;
  /** The page's path under the site, e.g. "/docs/install". */
  url: string;
};

function buildSiteUrl(sitePath: string) {
  return `${siteOrigin}${basePath}${sitePath.replace(/\/?$/, "/")}`;
}

/**
 * /llms.txt for this docs version (WS-09.3, the llms.txt convention): what
 * SendMock is, how an agent installs it, and every docs page.
 */
export function buildLlmsText(
  installPrompt: string | null,
  docsPages: LlmsDocsPage[],
): string {
  const versionLine =
    currentDocsVersion?.kind === "preview"
      ? "SendMock has no stable release yet. These docs follow `develop`; the install commands work from the first beta."
      : `These are the docs for ${currentDocsVersion?.label ?? "SendMock"}.`;
  const installSection =
    installPrompt === null
      ? []
      : [
          "## Install SendMock (instructions for AI agents)",
          "",
          "When a user asks you to install SendMock, follow these instructions. They are the prompt the docs give users to paste into an agent.",
          "",
          "```text",
          installPrompt,
          "```",
          "",
        ];
  const docsLinks = docsPages.map((docsPage) =>
    docsPage.description === undefined || docsPage.description === ""
      ? `- [${docsPage.title}](${buildSiteUrl(docsPage.url)})`
      : `- [${docsPage.title}](${buildSiteUrl(docsPage.url)}): ${docsPage.description}`,
  );

  return [
    "# SendMock",
    "",
    "> A local sandbox for email, SMS, payments and webhooks: one binary that catches every message your app sends, shows it in a web UI and calls your webhooks, on your own machine.",
    "",
    versionLine,
    "",
    ...installSection,
    "## Docs",
    "",
    ...docsLinks,
    "",
    "## Optional",
    "",
    `- [API reference](${buildSiteUrl("/api")}): every REST operation, with a playground`,
    `- [CLI reference](${buildSiteUrl("/cli")}): every \`sendmock\` command`,
    `- [MCP reference](${buildSiteUrl("/mcp")}): every MCP tool for agents`,
    `- [Live demo](${buildSiteUrl("/demo")}): the web UI with demo data`,
    "",
  ].join("\n");
}
