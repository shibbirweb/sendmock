import { ChevronDownIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The values people reach for most, one click away (WH-07.14). */
export const commonTemplateInserts = [
  {
    label: "Event type",
    insertText: "{{ event.type }}",
  },
  {
    label: "Recipient",
    insertText: "{{ data.to[0].address }}",
  },
  {
    label: "Subject",
    insertText: "{{ data.subject }}",
  },
  {
    label: "OTP code",
    insertText: "{{ data.extracted.otp[0] }}",
  },
  {
    label: "Random id",
    insertText: "{{ random_string(16) }}",
  },
  {
    label: "Timestamp",
    insertText: "{{ now_unix() }}",
  },
];

/** A menu that inserts a common value at the caret of a template editor. */
export function TemplateInsertMenu({
  onInsert,
}: {
  onInsert: (insertText: string) => void;
}) {
  // Set when an item inserted text: the editor then keeps focus (its caret
  // after the text) instead of focus going back to the Insert button.
  const hasInsertedRef = React.useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PlusIcon />
          Insert
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(closeEvent) => {
          if (hasInsertedRef.current) {
            hasInsertedRef.current = false;
            closeEvent.preventDefault();
          }
        }}
      >
        {commonTemplateInserts.map((templateInsert) => (
          <DropdownMenuItem
            key={templateInsert.label}
            onSelect={() => {
              hasInsertedRef.current = true;
              onInsert(templateInsert.insertText);
            }}
          >
            <span>{templateInsert.label}</span>
            <code className="ml-auto pl-4 font-mono text-[11px] text-muted-foreground">
              {templateInsert.insertText}
            </code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
