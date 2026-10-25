import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A list of short values (domains, patterns) shown as removable chips. */
export function ChipListInput({
  inputId,
  values,
  placeholder,
  onChange,
  isInvalid = false,
}: {
  inputId: string;
  values: string[];
  placeholder: string;
  onChange: (nextValues: string[]) => void;
  isInvalid?: boolean;
}) {
  const [draftValue, setDraftValue] = React.useState("");

  const addDraftValue = () => {
    const trimmedValue = draftValue.trim();
    if (trimmedValue === "" || values.includes(trimmedValue)) {
      setDraftValue("");
      return;
    }

    onChange([...values, trimmedValue]);
    setDraftValue("");
  };

  return (
    <div className="grid gap-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((listValue) => (
            <li
              key={listValue}
              className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-0.5 pl-2.5 font-mono text-xs"
            >
              {listValue}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 rounded-full"
                aria-label={`Remove ${listValue}`}
                onClick={() => {
                  onChange(
                    values.filter(
                      (existingValue) => existingValue !== listValue,
                    ),
                  );
                }}
              >
                <XIcon className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draftValue}
          placeholder={placeholder}
          aria-invalid={isInvalid}
          onChange={(changeEvent) => {
            setDraftValue(changeEvent.target.value);
          }}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter") {
              keyboardEvent.preventDefault();
              addDraftValue();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addDraftValue}>
          Add
        </Button>
      </div>
    </div>
  );
}
