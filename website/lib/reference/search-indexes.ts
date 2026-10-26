/**
 * Search entries for the generated references (API, CLI, MCP) next to the
 * docs pages, so the site search finds a command, a tool or an endpoint
 * (docs/plan/21-reference-and-examples.md).
 */
import type { AdvancedIndex } from "fumadocs-core/search/server";

import { loadApiReference } from "@/lib/openapi/load-openapi";
import { source } from "@/lib/source";

import {
  loadCliReference,
  loadMcpReference,
  toCliCommandUrl,
  toMcpResourceUrl,
  toMcpToolUrl,
} from "./load-references";

type PageTreeNode = {
  type: string;
  name?: unknown;
  url?: string;
  index?: { url: string };
  children?: PageTreeNode[];
};

/** Each docs page's folders, as the default search index shows them. */
function collectDocsBreadcrumbs(
  treeNodes: PageTreeNode[],
  folderNames: string[],
  breadcrumbsByUrl: Map<string, string[]>,
): Map<string, string[]> {
  for (const treeNode of treeNodes) {
    if (treeNode.type === "page" && treeNode.url !== undefined) {
      breadcrumbsByUrl.set(treeNode.url, folderNames);
    }
    if (treeNode.type === "folder") {
      const folderName = typeof treeNode.name === "string" ? treeNode.name : "";
      if (treeNode.index !== undefined) {
        breadcrumbsByUrl.set(treeNode.index.url, folderNames);
      }
      collectDocsBreadcrumbs(
        treeNode.children ?? [],
        [...folderNames, folderName],
        breadcrumbsByUrl,
      );
    }
  }

  return breadcrumbsByUrl;
}

function buildDocsIndexes(): AdvancedIndex[] {
  const breadcrumbsByUrl = collectDocsBreadcrumbs(
    source.getPageTree().children as PageTreeNode[],
    [],
    new Map(),
  );

  return source.getPages().map((docsPage) => ({
    id: docsPage.url,
    title: docsPage.data.title ?? docsPage.url,
    description: docsPage.data.description,
    url: docsPage.url,
    breadcrumbs: breadcrumbsByUrl.get(docsPage.url),
    structuredData: docsPage.data.structuredData,
  }));
}

function buildReferenceIndex(entry: {
  title: string;
  description: string;
  url: string;
  breadcrumbs: string[];
}): AdvancedIndex {
  return {
    id: entry.url,
    title: entry.title,
    description: entry.description,
    url: entry.url,
    breadcrumbs: entry.breadcrumbs,
    structuredData: {
      headings: [],
      contents: [{ heading: undefined, content: entry.description }],
    },
  };
}

function buildApiAndSurfaceIndexes(): AdvancedIndex[] {
  const apiIndexes = loadApiReference().operations.map((operation) =>
    buildReferenceIndex({
      title: `${operation.method} ${operation.path}`,
      description: operation.summary,
      url: `/api/${operation.tagSlug}/#${operation.operationId}`,
      breadcrumbs: ["API", operation.tag],
    }),
  );
  const cliIndexes = loadCliReference().commands.map((cliCommand) =>
    buildReferenceIndex({
      title: cliCommand.command,
      description: cliCommand.summary,
      url: toCliCommandUrl(cliCommand),
      breadcrumbs: ["CLI", cliCommand.area],
    }),
  );
  const mcpReference = loadMcpReference();
  const mcpIndexes = [
    ...mcpReference.tools.map((mcpTool) =>
      buildReferenceIndex({
        title: mcpTool.name,
        description: mcpTool.summary,
        url: toMcpToolUrl(mcpTool),
        breadcrumbs: ["MCP", mcpTool.area],
      }),
    ),
    ...mcpReference.resources.map((mcpResource) =>
      buildReferenceIndex({
        title: mcpResource.uri,
        description: mcpResource.summary,
        url: toMcpResourceUrl(mcpResource),
        breadcrumbs: ["MCP", mcpResource.area],
      }),
    ),
  ];

  return [...apiIndexes, ...cliIndexes, ...mcpIndexes];
}

export function buildSiteSearchIndexes(): AdvancedIndex[] {
  return [...buildDocsIndexes(), ...buildApiAndSurfaceIndexes()];
}
