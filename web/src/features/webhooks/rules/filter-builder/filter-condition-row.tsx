import { Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ConditionValueInput } from "@/features/webhooks/rules/filter-builder/condition-value-input";
import { useFilterBuilderContext } from "@/features/webhooks/rules/filter-builder/filter-builder-context";
import type { RuleFilterOperator } from "@/lib/api/types";
import type { BuilderCondition } from "@/lib/webhooks/rule-filter/builder-tree";
import {
  findRuleFieldDefinition,
  headerFieldPrefix,
  type RuleValueKind,
} from "@/lib/webhooks/rule-filter/rule-fields";
import {
  ruleOperatorOrder,
  ruleOperators,
} from "@/lib/webhooks/rule-filter/rule-operators";
import { validateRuleCondition } from "@/lib/webhooks/rule-filter/validate-rule-filter";

/** Fixed-list and number fields only make sense with equals or exists. */
function listOperatorsForKind(valueKind: RuleValueKind): RuleFilterOperator[] {
  return valueKind === "text" ? ruleOperatorOrder : ["equals", "exists"];
}

function readConditionError(
  builderCondition: BuilderCondition,
): string | undefined {
  const field =
    builderCondition.fieldKey === headerFieldPrefix
      ? `${headerFieldPrefix}${builderCondition.headerName.trim()}`
      : builderCondition.fieldKey;

  return validateRuleCondition({
    field,
    operator: builderCondition.operator,
    value: builderCondition.value,
  });
}

/** One condition: not toggle, field, operator, value and remove (WH-02.5). */
export function FilterConditionRow({
  builderCondition,
  rowNumber,
}: {
  builderCondition: BuilderCondition;
  rowNumber: number;
}) {
  const { fieldDefinitions, isShowingErrors, updateNode, removeNode } =
    useFilterBuilderContext();
  const fieldDefinition = findRuleFieldDefinition(builderCondition.fieldKey);
  const valueKind = fieldDefinition?.valueKind ?? "text";
  const allowedOperators = listOperatorsForKind(valueKind);
  const conditionError = isShowingErrors
    ? readConditionError(builderCondition)
    : undefined;
  const updateCondition = (changedFields: Partial<BuilderCondition>) => {
    updateNode(builderCondition.nodeId, (builderNode) =>
      builderNode.nodeKind === "condition"
        ? { ...builderNode, ...changedFields }
        : builderNode,
    );
  };

  return (
    <li data-testid="filter-condition" className="grid gap-1">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[auto_9rem_9rem_minmax(0,1fr)_auto]">
        <Toggle
          size="sm"
          variant="outline"
          aria-label={`Negate condition ${rowNumber}`}
          pressed={builderCondition.isNegated}
          onPressedChange={(isNegated) => {
            updateCondition({ isNegated });
          }}
          className="font-mono text-xs"
        >
          not
        </Toggle>
        <div className="grid gap-1">
          <Select
            value={builderCondition.fieldKey}
            onValueChange={(nextFieldKey) => {
              const nextKind =
                findRuleFieldDefinition(nextFieldKey)?.valueKind ?? "text";
              updateCondition({
                fieldKey: nextFieldKey,
                operator: listOperatorsForKind(nextKind).includes(
                  builderCondition.operator,
                )
                  ? builderCondition.operator
                  : "equals",
                value: nextKind === valueKind ? builderCondition.value : "",
              });
            }}
          >
            <SelectTrigger aria-label={`Field ${rowNumber}`} className="w-full">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {fieldDefinitions.map((availableField) => (
                <SelectItem
                  key={availableField.fieldKey}
                  value={availableField.fieldKey}
                >
                  {availableField.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {builderCondition.fieldKey === headerFieldPrefix && (
            <Input
              aria-label={`Header name ${rowNumber}`}
              placeholder="X-Tenant"
              className="font-mono text-xs"
              value={builderCondition.headerName}
              onChange={(changeEvent) => {
                updateCondition({ headerName: changeEvent.target.value });
              }}
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove condition ${rowNumber}`}
          className="sm:order-last"
          onClick={() => {
            removeNode(builderCondition.nodeId);
          }}
        >
          <Trash2Icon />
        </Button>
        <div className="col-span-3 grid grid-cols-[9rem_minmax(0,1fr)] gap-2 sm:col-span-2 sm:grid-cols-subgrid">
          <Select
            value={builderCondition.operator}
            onValueChange={(nextOperator) => {
              updateCondition({ operator: nextOperator as RuleFilterOperator });
            }}
          >
            <SelectTrigger
              aria-label={`Operator ${rowNumber}`}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedOperators.map((ruleOperator) => (
                <SelectItem key={ruleOperator} value={ruleOperator}>
                  {ruleOperators[ruleOperator].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ruleOperators[builderCondition.operator].needsValue ? (
            <ConditionValueInput
              valueKind={valueKind}
              value={builderCondition.value}
              ariaLabel={`Value ${rowNumber}`}
              isInvalid={conditionError !== undefined}
              onChange={(value) => {
                updateCondition({ value });
              }}
            />
          ) : (
            <span />
          )}
        </div>
      </div>
      <FormFieldError errorMessage={conditionError} />
    </li>
  );
}
