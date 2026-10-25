import { PlusIcon, Trash2Icon } from "lucide-react";

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
import {
  fromOutcomeValue,
  toOutcomeValue,
} from "@/features/payments/methods/test-outcome-options";
import type { TestCardValue, TestWalletValue } from "@/lib/api/types";

type TestValue = TestCardValue | TestWalletValue;

/** Rows of a test number and its outcome: a card method's cards or a wallet's numbers (PY-12.1). */
export function TestValuesEditor<Value extends TestValue>({
  legend,
  rowLabel,
  numberPlaceholder,
  testValues,
  outcomeOptions,
  errorMessage,
  onChange,
}: {
  legend: string;
  rowLabel: string;
  numberPlaceholder: string;
  testValues: Value[];
  outcomeOptions: { value: string; label: string }[];
  errorMessage: string | undefined;
  onChange: (nextValues: Value[]) => void;
}) {
  const updateRow = (rowIndex: number, changedFields: Partial<TestValue>) => {
    onChange(
      testValues.map((testValue, valueIndex) =>
        valueIndex === rowIndex
          ? ({ ...testValue, ...changedFields } as Value)
          : testValue,
      ),
    );
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {testValues.map((testValue, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
        >
          <Input
            aria-label={`${rowLabel} ${rowIndex + 1} number`}
            placeholder={numberPlaceholder}
            inputMode="numeric"
            className="font-mono text-xs"
            value={testValue.number}
            onChange={(changeEvent) => {
              updateRow(rowIndex, {
                number: changeEvent.target.value.replace(/[\s-]/g, ""),
              });
            }}
          />
          <Select
            value={toOutcomeValue(testValue)}
            onValueChange={(outcomeValue) => {
              updateRow(
                rowIndex,
                fromOutcomeValue(outcomeValue) as Partial<TestValue>,
              );
            }}
          >
            <SelectTrigger
              aria-label={`${rowLabel} ${rowIndex + 1} outcome`}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {outcomeOptions.map((outcomeOption) => (
                <SelectItem
                  key={outcomeOption.value}
                  value={outcomeOption.value}
                >
                  {outcomeOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${rowLabel.toLowerCase()} ${rowIndex + 1}`}
            onClick={() => {
              onChange(
                testValues.filter((_, valueIndex) => valueIndex !== rowIndex),
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
          onChange([
            ...testValues,
            { number: "", outcome: "succeed", decline_reason: null } as Value,
          ]);
        }}
      >
        <PlusIcon />
        Add {rowLabel.toLowerCase()}
      </Button>
      <FormFieldError errorMessage={errorMessage} />
    </fieldset>
  );
}
