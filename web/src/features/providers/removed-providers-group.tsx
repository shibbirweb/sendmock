import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MessageProviderDefinition } from "@/lib/api/types";

/** Built-ins taken out of use, each with Restore (EM-18.3, SM-16.3). */
export function RemovedProvidersGroup({
  removedProviders,
  isRestoring,
  onRestore,
}: {
  removedProviders: MessageProviderDefinition[];
  isRestoring: boolean;
  onRestore: (removedProvider: MessageProviderDefinition) => void;
}) {
  if (removedProviders.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="removed-providers-heading"
      className="grid gap-2 rounded-lg border border-dashed p-4"
    >
      <div className="grid gap-0.5">
        <h3 id="removed-providers-heading" className="text-sm font-medium">
          Removed
        </h3>
        <p className="text-xs text-muted-foreground">
          Requests to their paths get a 404 until you restore them; their
          messages stay.
        </p>
      </div>
      <ul className="grid gap-1">
        {removedProviders.map((removedProvider) => (
          <li
            key={removedProvider.key}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full opacity-50"
                style={{ backgroundColor: removedProvider.accent }}
              />
              <span>{removedProvider.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {removedProvider.key}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isRestoring}
              onClick={() => onRestore(removedProvider)}
            >
              <RotateCcwIcon />
              Restore
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
