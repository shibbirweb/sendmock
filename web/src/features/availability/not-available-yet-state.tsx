import { ClockIcon, ExternalLinkIcon } from "lucide-react";

import { roadmapUrl } from "@/lib/community/community-links";
import type { StageBPhase } from "@/lib/api/surface-catalogue";
import { cn } from "@/lib/utils";

/**
 * What a screen or section shows while the running SendMock does not serve it yet
 * (UI-12.2): when it arrives, what it will do, and the roadmap. Shown next to
 * QueryErrorState, never instead of real data.
 */
export function NotAvailableYetState({
  featureName,
  phase,
  description,
  className,
}: {
  /** "SMS", "Seed": the screen or section. */
  featureName: string;
  phase: StageBPhase;
  /** One line on what it will do. */
  description: string;
  className?: string;
}) {
  return (
    <section
      aria-label={`${featureName} arrives in Phase ${phase}`}
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <ClockIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="text-base font-semibold">
        {featureName} arrives in Phase {phase}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <a
        href={roadmapUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        See the roadmap
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </a>
    </section>
  );
}
