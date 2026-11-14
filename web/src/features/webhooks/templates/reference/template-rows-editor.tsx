import {
  type NameValueRow,
  NameValueRowsEditor,
} from "@/components/common/name-value-rows-editor";
import { TemplateTextField } from "@/features/webhooks/templates/reference/template-text-field";
import type { TemplateReference } from "@/lib/api/types";

/** Name and template value rows (headers, query params) with `{{` suggestions in each value. */
export function TemplateRowsEditor({
  legend,
  rowLabel,
  namePlaceholder,
  emptyText,
  rows,
  templateReference,
  onChange,
}: {
  legend: string;
  rowLabel: string;
  namePlaceholder: string;
  emptyText: string;
  rows: NameValueRow[];
  templateReference: TemplateReference | undefined;
  onChange: (nextRows: NameValueRow[]) => void;
}) {
  return (
    <NameValueRowsEditor
      legend={legend}
      rowLabel={rowLabel}
      namePlaceholder={namePlaceholder}
      emptyText={emptyText}
      rows={rows}
      onChange={onChange}
      renderValueInput={({ ariaLabel, rowValue, onValueChange }) => (
        <TemplateTextField
          ariaLabel={ariaLabel}
          placeholder="value or {{ template }}"
          value={rowValue}
          templateReference={templateReference}
          onChange={onValueChange}
        />
      )}
    />
  );
}
