import { BracesIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { flowLabelVariables } from "@/lib/payments/flow-label-variables";

/** A step label field with an Insert variable menu that inserts at the caret (PY-12.7). */
export function StepLabelInput({
  fieldId,
  label,
  value,
  onChange,
}: {
  fieldId: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  // The caret is kept while the menu has focus, so the variable lands there.
  const caretRef = React.useRef<number | null>(null);
  const rememberCaret = () => {
    caretRef.current = inputRef.current?.selectionStart ?? null;
  };

  return (
    <div className="flex gap-1">
      <Input
        ref={inputRef}
        id={fieldId}
        className="text-sm"
        value={value}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onChange={(changeEvent) => {
          onChange(changeEvent.target.value);
          caretRef.current = changeEvent.target.selectionStart;
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0"
            aria-label={`Insert variable into ${label}`}
          >
            <BracesIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Insert variable</DropdownMenuLabel>
          {flowLabelVariables.map((flowVariable) => (
            <DropdownMenuItem
              key={flowVariable.name}
              className="grid gap-0.5"
              onSelect={() => {
                const insertAt = caretRef.current ?? value.length;
                onChange(
                  `${value.slice(0, insertAt)}${flowVariable.token}${value.slice(insertAt)}`,
                );
                caretRef.current = insertAt + flowVariable.token.length;
              }}
            >
              <code className="font-mono text-xs">{flowVariable.token}</code>
              <span className="text-xs text-muted-foreground">
                {flowVariable.description}, e.g. {flowVariable.example}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
