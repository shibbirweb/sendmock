import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ResponseRuleFormValues } from "@/features/http/responses/use-response-rule-form";
import { FilterBuilder } from "@/features/webhooks/rules/filter-builder/filter-builder";
import type { HttpMethod } from "@/lib/api/types";
import type { ResponseRuleFieldErrors } from "@/lib/http/validate-response-rule";
import { ruleFieldDefinitions } from "@/lib/webhooks/rule-filter/rule-fields";

const matchMethods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const httpFieldDefinitions = ruleFieldDefinitions.filter((fieldDefinition) =>
  fieldDefinition.subjects.includes("http"),
);

/** Method, path glob and header / body conditions (HC-02.1, HC-02.4). */
export function ResponseRuleMatchFields({
  formValues,
  fieldErrors,
  hasTriedSaving,
  onChange,
}: {
  formValues: ResponseRuleFormValues;
  fieldErrors: ResponseRuleFieldErrors;
  hasTriedSaving: boolean;
  onChange: (changedValues: Partial<ResponseRuleFormValues>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-sm font-semibold">Match</legend>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3">
        <FormField label="Method" fieldId={`${fieldIdPrefix}-method`}>
          <Select
            value={formValues.method}
            onValueChange={(selectedMethod) => {
              onChange({ method: selectedMethod as HttpMethod | "any" });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-method`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {matchMethods.map((matchMethod) => (
                <SelectItem key={matchMethod} value={matchMethod}>
                  {matchMethod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Path"
          fieldId={`${fieldIdPrefix}-path`}
          hint="Relative to the bin; * matches any run. Empty matches every path."
          errorMessage={fieldErrors.path_glob}
        >
          <Input
            id={`${fieldIdPrefix}-path`}
            className="font-mono text-xs"
            placeholder="/v1/*"
            value={formValues.pathGlob}
            aria-invalid={fieldErrors.path_glob !== undefined}
            onChange={(changeEvent) => {
              onChange({ pathGlob: changeEvent.target.value });
            }}
          />
        </FormField>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Conditions</span>
        <FilterBuilder
          rootGroup={formValues.rootGroup}
          fieldDefinitions={httpFieldDefinitions}
          isShowingErrors={hasTriedSaving}
          onChange={(rootGroup) => {
            onChange({ rootGroup });
          }}
        />
      </div>
    </fieldset>
  );
}
