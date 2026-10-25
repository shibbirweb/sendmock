import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  const statistics = [
    {
      value: allEmulatedProviderNames.length,
      label: "provider APIs emulated",
    },
    { value: testedLanguageNames.length, label: "languages tested in CI" },
    { value: countApiOperations(), label: "REST API operations" },
  ];

  return (
    <section
      aria-label="SendMock in numbers"
      className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 sm:grid-cols-3"
    >
      {statistics.map((statistic) => (
        <div
          key={statistic.label}
          className="flex flex-col items-center gap-1 rounded-xl border bg-fd-card p-6 text-center"
        >
          <NumberTicker
            value={statistic.value}
            className="text-4xl font-bold"
            data-testid="number-ticker"
          />
          <span className="text-sm text-fd-muted-foreground">
            {statistic.label}
          </span>
        </div>
      ))}
    </section>
  );
}
