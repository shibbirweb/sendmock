import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type NameValueRow = {
  rowId: number;
  rowName: string;
  rowValue: string;
};

/** Rows of name and value inputs, e.g. extra headers or body fields. */
export function NameValueRowsEditor({
  legend,
  rowLabel,
  namePlaceholder,
  emptyText,
  rows,
  onChange,
}: {
  legend: string;
  /** "Header" gives "Header 1 name", "Remove header 1". */
  rowLabel: string;
  namePlaceholder: string;
  emptyText: string;
  rows: NameValueRow[];
  onChange: (nextRows: NameValueRow[]) => void;
}) {
  const updateRow = (rowId: number, changedFields: Partial<NameValueRow>) => {
    onChange(
      rows.map((row) =>
        row.rowId === rowId ? { ...row, ...changedFields } : row,
      ),
    );
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
      {rows.map((row, rowIndex) => (
        <div key={row.rowId} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
          <Input
            aria-label={`${rowLabel} ${rowIndex + 1} name`}
            placeholder={namePlaceholder}
            className="font-mono text-xs"
            value={row.rowName}
            onChange={(changeEvent) => {
              updateRow(row.rowId, { rowName: changeEvent.target.value });
            }}
          />
          <Input
            aria-label={`${rowLabel} ${rowIndex + 1} value`}
            placeholder="value or {{ template }}"
            className="font-mono text-xs"
            value={row.rowValue}
            onChange={(changeEvent) => {
              updateRow(row.rowId, { rowValue: changeEvent.target.value });
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${rowLabel.toLowerCase()} ${rowIndex + 1}`}
            onClick={() => {
              onChange(
                rows.filter((existingRow) => existingRow.rowId !== row.rowId),
              );
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          const nextRowId = Math.max(0, ...rows.map((row) => row.rowId)) + 1;
          onChange([...rows, { rowId: nextRowId, rowName: "", rowValue: "" }]);
        }}
      >
        <PlusIcon />
        Add {rowLabel.toLowerCase()}
      </Button>
    </fieldset>
  );
}

/** `{ "X-Tenant": "acme" }` as editable rows. */
export function toNameValueRows(
  record: Record<string, string>,
): NameValueRow[] {
  return Object.entries(record).map(([rowName, rowValue], rowIndex) => ({
    rowId: rowIndex + 1,
    rowName,
    rowValue,
  }));
}

/** Rows back to a record, skipping rows without a name. */
export function fromNameValueRows(
  rows: NameValueRow[],
): Record<string, string> {
  return Object.fromEntries(
    rows
      .filter((row) => row.rowName.trim() !== "")
      .map((row) => [row.rowName.trim(), row.rowValue]),
  );
}
