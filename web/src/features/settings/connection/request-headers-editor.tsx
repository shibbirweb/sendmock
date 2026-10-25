import { KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HeaderRow } from "@/features/settings/connection/use-request-customization";

/** Name and value rows added to every API snippet. */
export function RequestHeadersEditor({
  headerRows,
  onAdd,
  onUpdate,
  onRemove,
}: {
  headerRows: HeaderRow[];
  onAdd: (headerName?: string, headerValue?: string) => void;
  onUpdate: (
    rowId: number,
    changedFields: { headerName?: string; headerValue?: string },
  ) => void;
  onRemove: (rowId: number) => void;
}) {
  const hasAuthorizationHeader = headerRows.some(
    (headerRow) =>
      headerRow.headerName.trim().toLowerCase() === "authorization",
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Request headers</legend>
      {headerRows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          None besides Content-Type. Add one for an API token, an idempotency
          key or tracing.
        </p>
      )}
      {headerRows.map((headerRow, rowIndex) => (
        <div
          key={headerRow.rowId}
          className="grid grid-cols-[1fr_1.5fr_auto] gap-2"
        >
          <Input
            aria-label={`Header ${rowIndex + 1} name`}
            placeholder="X-Request-Id"
            className="font-mono text-xs"
            value={headerRow.headerName}
            onChange={(changeEvent) =>
              onUpdate(headerRow.rowId, {
                headerName: changeEvent.target.value,
              })
            }
          />
          <Input
            aria-label={`Header ${rowIndex + 1} value`}
            placeholder="value"
            className="font-mono text-xs"
            value={headerRow.headerValue}
            onChange={(changeEvent) =>
              onUpdate(headerRow.rowId, {
                headerValue: changeEvent.target.value,
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove header ${rowIndex + 1}`}
            onClick={() => onRemove(headerRow.rowId)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd()}
        >
          <PlusIcon />
          Add header
        </Button>
        {!hasAuthorizationHeader && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAdd("Authorization", "Bearer YOUR_API_TOKEN")}
          >
            <KeyRoundIcon />
            Add Authorization header
          </Button>
        )}
      </div>
    </fieldset>
  );
}
