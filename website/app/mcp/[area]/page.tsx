import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  McpResourceReference,
  McpToolReference,
} from "@/components/reference/mcp-tool-reference";
import {
  indexCliCommandUrls,
  listAreas,
  loadMcpReference,
  toNamedLinks,
} from "@/lib/reference/load-references";

type AreaPageProps = { params: Promise<{ area: string }> };

function listMcpAreas() {
  const mcpReference = loadMcpReference();
  return listAreas([...mcpReference.tools, ...mcpReference.resources]);
}

export function generateStaticParams() {
  return listMcpAreas().map((area) => ({ area: area.slug }));
}

export async function generateMetadata({
  params,
}: AreaPageProps): Promise<Metadata> {
  const { area } = await params;
  const areaName = listMcpAreas().find(
    (listedArea) => listedArea.slug === area,
  )?.name;
  return {
    title: `${areaName ?? "MCP"} tools`,
    description: `The ${areaName} tools of the SendMock MCP server, with every input.`,
  };
}

export default async function McpAreaPage({ params }: AreaPageProps) {
  const { area } = await params;
  const areaName = listMcpAreas().find(
    (listedArea) => listedArea.slug === area,
  )?.name;
  if (areaName === undefined) {
    notFound();
  }
  const mcpReference = loadMcpReference();
  const cliCommandUrls = indexCliCommandUrls();

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-2 px-4 py-12">
      <p className="text-sm">
        <Link href="/mcp" className="text-fd-muted-foreground hover:underline">
          MCP reference
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{areaName} tools</h1>
      {mcpReference.tools
        .filter((mcpTool) => mcpTool.area_slug === area)
        .map((mcpTool) => (
          <McpToolReference
            key={mcpTool.name}
            mcpTool={mcpTool}
            cliLinks={toNamedLinks(mcpTool.cli, cliCommandUrls)}
          />
        ))}
      {mcpReference.resources
        .filter((mcpResource) => mcpResource.area_slug === area)
        .map((mcpResource) => (
          <McpResourceReference
            key={mcpResource.slug}
            mcpResource={mcpResource}
            cliLinks={toNamedLinks([mcpResource.cli], cliCommandUrls)}
          />
        ))}
    </main>
  );
}
