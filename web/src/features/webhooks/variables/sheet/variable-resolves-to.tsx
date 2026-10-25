import { CircleAlertIcon, CircleXIcon } from "lucide-react";

import type { VariablePreviewResult } from "@/lib/api/types";

/** What the variable becomes against the sample email (WH-07.12). */
export function VariableResolvesTo({
  previewResult,
}: {
  previewResult: VariablePreviewResult | undefined;
}) {
  return (
    <section
      aria-label="Resolves to"
      className="grid gap-1.5 rounded-md border bg-muted/30 p-3"
    >
      <h3 className="text-xs font-medium text-muted-foreground">
        Resolves to, with the sample email
      </h3>
      <code
        data-testid="resolved-value"
        className="font-mono text-xs break-all whitespace-pre-wrap"
      >
        {previewResult === undefined
          ? "..."
          : previewResult.resolved_value || "(empty)"}
      </code>
      {previewResult?.errors.map((errorText) => (
        <p key={errorText} className="flex gap-1.5 text-xs text-destructive">
          <CircleXIcon
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {errorText}
        </p>
      ))}
      {previewResult?.warnings.map((warningText) => (
        <p key={warningText} className="flex gap-1.5 text-xs">
          <CircleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-warning"
          />
          {warningText}
        </p>
      ))}
    </section>
  );
}
