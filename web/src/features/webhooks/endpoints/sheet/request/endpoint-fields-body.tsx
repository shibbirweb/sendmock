import { PlusIcon, Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BodyFieldRow,
  WebhookEndpointFormValues,
} from "@/features/webhooks/endpoints/sheet/use-webhook-endpoint-form";
import { TemplateTextField } from "@/features/webhooks/templates/reference/template-text-field";
import type { BodyFieldType, TemplateReference } from "@/lib/api/types";

const bodyFieldTypes: { value: BodyFieldType; label: string }[] = [
  {
    value: "text",
    label: "Text",
  },
  {
    value: "number",
    label: "Number",
  },
  {
    value: "boolean",
    label: "Boolean",
  },
  {
    value: "json",
    label: "JSON",
  },
];

/**
 * Fields body mode: typed name and value rows that SendMock encodes as
 * JSON or a form, so the body is always valid (WH-07.14).
 */
export function EndpointFieldsBody({
  formValues,
  errorMessage,
  templateReference,
  onChange,
}: {
  formValues: WebhookEndpointFormValues;
  errorMessage: string | undefined;
  templateReference: TemplateReference | undefined;
  onChange: (changedValues: Partial<WebhookEndpointFormValues>) => void;
}) {
  const { bodyFieldRows } = formValues;
  const updateRow = (rowId: number, changedFields: Partial<BodyFieldRow>) => {
    onChange({
      bodyFieldRows: bodyFieldRows.map((bodyFieldRow) =>
        bodyFieldRow.rowId === rowId
          ? { ...bodyFieldRow, ...changedFields }
          : bodyFieldRow,
      ),
    });
  };

  return (
    <div className="grid gap-4">
      <RadioCardGroup<"json" | "form">
        legend="Encoding"
        className="sm:grid-cols-2"
        selectedValue={formValues.fieldsEncoding}
        options={[
          {
            value: "json",
            label: "JSON",
            description: "Typed values; dots nest, e.g. user.email.",
          },
          {
            value: "form",
            label: "Form",
            description: "application/x-www-form-urlencoded, all text.",
          },
        ]}
        onSelect={(fieldsEncoding) => {
          onChange({ fieldsEncoding });
        }}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Fields</legend>
        {bodyFieldRows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No fields yet: the body is an empty object.
          </p>
        )}
        {bodyFieldRows.map((bodyFieldRow, rowIndex) => (
          <div
            key={bodyFieldRow.rowId}
            className="grid grid-cols-[1fr_6.5rem_1.5fr_auto] items-start gap-2"
          >
            <Input
              aria-label={`Field ${rowIndex + 1} name`}
              placeholder="user.email"
              className="font-mono text-xs"
              value={bodyFieldRow.fieldName}
              onChange={(changeEvent) => {
                updateRow(bodyFieldRow.rowId, {
                  fieldName: changeEvent.target.value,
                });
              }}
            />
            <Select
              value={bodyFieldRow.valueType}
              disabled={formValues.fieldsEncoding === "form"}
              onValueChange={(valueType) => {
                updateRow(bodyFieldRow.rowId, {
                  valueType: valueType as BodyFieldType,
                });
              }}
            >
              <SelectTrigger
                aria-label={`Field ${rowIndex + 1} type`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bodyFieldTypes.map((bodyFieldType) => (
                  <SelectItem
                    key={bodyFieldType.value}
                    value={bodyFieldType.value}
                  >
                    {bodyFieldType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TemplateTextField
              ariaLabel={`Field ${rowIndex + 1} value`}
              placeholder="value or {{ template }}"
              value={bodyFieldRow.fieldValue}
              templateReference={templateReference}
              onChange={(fieldValue) => {
                updateRow(bodyFieldRow.rowId, { fieldValue });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove field ${rowIndex + 1}`}
              onClick={() => {
                onChange({
                  bodyFieldRows: bodyFieldRows.filter(
                    (existingRow) => existingRow.rowId !== bodyFieldRow.rowId,
                  ),
                });
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
            const nextRowId =
              Math.max(0, ...bodyFieldRows.map((row) => row.rowId)) + 1;
            onChange({
              bodyFieldRows: [
                ...bodyFieldRows,
                {
                  rowId: nextRowId,
                  fieldName: "",
                  valueType: "text",
                  fieldValue: "",
                },
              ],
            });
          }}
        >
          <PlusIcon />
          Add field
        </Button>
        <FormFieldError errorMessage={errorMessage} />
      </fieldset>
    </div>
  );
}
