import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CliCommandReference } from "@/components/reference/cli-command-reference";
import {
  indexMcpEntryUrls,
  listAreas,
  loadCliReference,
  toNamedLinks,
} from "@/lib/reference/load-references";

type AreaPageProps = { params: Promise<{ area: string }> };

export function generateStaticParams() {
  return listAreas(loadCliReference().commands).map((area) => ({
    area: area.slug,
  }));
}

export async function generateMetadata({
  params,
}: AreaPageProps): Promise<Metadata> {
  const { area } = await params;
  const areaName = listAreas(loadCliReference().commands).find(
    (listedArea) => listedArea.slug === area,
  )?.name;
  return {
    title: `${areaName ?? "CLI"} commands`,
    description: `The ${areaName} commands of the sendmock CLI, with every flag.`,
  };
}

export default async function CliAreaPage({ params }: AreaPageProps) {
  const { area } = await params;
  const cliReference = loadCliReference();
  const areaName = listAreas(cliReference.commands).find(
    (listedArea) => listedArea.slug === area,
  )?.name;
  if (areaName === undefined) {
    notFound();
  }
  const mcpEntryUrls = indexMcpEntryUrls();

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-2 px-4 py-12">
      <p className="text-sm">
        <Link href="/cli" className="text-fd-muted-foreground hover:underline">
          CLI reference
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{areaName} commands</h1>
      {cliReference.commands
        .filter((cliCommand) => cliCommand.area_slug === area)
        .map((cliCommand) => (
          <CliCommandReference
            key={cliCommand.slug}
            cliCommand={cliCommand}
            mcpLinks={toNamedLinks(cliCommand.mcp, mcpEntryUrls)}
          />
        ))}
    </main>
  );
}
