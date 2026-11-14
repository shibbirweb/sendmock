import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { NumberTicker } from "@/components/ui/number-ticker";
import {
  allEmulatedProviderNames,
  testedLanguageNames,
} from "@/lib/landing-data";

/** REST operations in the frozen contract, counted when the site is built. */
function countApiOperations(): number {
  const openApiYaml = readFileSync(
    join(process.cwd(), "../docs/api/openapi.yaml"),
    "utf8",
  );

  return (openApiYaml.match(/^ {4}(get|post|put|patch|delete):$/gm) ?? [])
    .length;
}

export function NumbersSection() {
  // Each number links to the page that lists what it counts, so it can be checked.
  const statistics = [
    {
      value: allEmulatedProviderNames.length,
      label: "built-in provider APIs",
      listHref: "/docs/providers",
      listLabel: "See the providers",
    },
    {
      value: testedLanguageNames.length,
      label: "languages with connection guides",
      listHref: "/docs/connect",
      listLabel: "See the languages",
    },
    {
      value: countApiOperations(),
      label: "REST API operations",
      listHref: "/api",
      listLabel: "See the operations",
    },
  ];

  return (
    <section
      aria-label="SendMock in numbers"
      className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 sm:grid-cols-3"
    >
      {statistics.map((statistic) => (
        <Link
          key={statistic.label}
          href={statistic.listHref}
          className="group flex flex-col items-center gap-1 rounded-xl border bg-fd-card p-6 text-center transition-colors hover:border-(--brand-from)/50"
        >
          <NumberTicker
            value={statistic.value}
            className="text-4xl font-bold"
            data-testid="number-ticker"
          />
          <span className="text-sm text-fd-muted-foreground">
            {statistic.label}
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-(--brand-text)">
            {statistic.listLabel}
            <ArrowRightIcon
              aria-hidden
              className="size-3 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      ))}
    </section>
  );
}
