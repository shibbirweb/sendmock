import { XIcon } from "lucide-react";
import * as React from "react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatScheduleSeconds,
  parseDelayText,
} from "@/lib/webhooks/build-attempt-schedule";

/** The delay before each retry, as removable chips; delays may repeat. */
export function RetryDelayChips({
  inputId,
  delaysSeconds,
  errorMessage,
  onChange,
}: {
  inputId: string;
  delaysSeconds: number[];
  errorMessage?: string;
  onChange: (nextDelaysSeconds: number[]) => void;
}) {
  const [draftText, setDraftText] = React.useState("");
  const [draftError, setDraftError] = React.useState<string | undefined>();

  const addDraftDelay = () => {
    const delaySeconds = parseDelayText(draftText);
    if (delaySeconds === null) {
      setDraftError('Type a delay such as "30s", "2m" or "1h"');
      return;
    }

    onChange([...delaysSeconds, delaySeconds]);
    setDraftText("");
    setDraftError(undefined);
  };

  return (
    <div className="grid gap-2">
      <ol aria-label="Retry delays" className="flex flex-wrap gap-1.5">
        {delaysSeconds.map((delaySeconds, delayIndex) => (
          <li
            key={`${delayIndex}-${delaySeconds}`}
            className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-0.5 pl-2.5 font-mono text-xs"
          >
            {formatScheduleSeconds(delaySeconds)}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5 rounded-full"
              aria-label={`Remove retry delay ${delayIndex + 1}`}
              onClick={() => {
                onChange(
                  delaysSeconds.filter(
                    (_, existingIndex) => existingIndex !== delayIndex,
                  ),
                );
              }}
            >
              <XIcon className="size-3" />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Input
          id={inputId}
          className="w-32 font-mono text-xs"
          placeholder="30s"
          value={draftText}
          aria-invalid={draftError !== undefined || errorMessage !== undefined}
          onChange={(changeEvent) => {
            setDraftText(changeEvent.target.value);
          }}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter") {
              keyboardEvent.preventDefault();
              addDraftDelay();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addDraftDelay}>
          Add delay
        </Button>
      </div>
      <FormFieldError errorMessage={draftError ?? errorMessage} />
    </div>
  );
}
