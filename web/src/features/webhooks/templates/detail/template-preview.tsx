import { CircleAlertIcon, CircleXIcon } from "lucide-react";
import * as React from "react";

import { HttpBodyView } from "@/components/common/http-body-view";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  sampleOption,
  type useTemplatePreview,
} from "@/features/webhooks/templates/detail/use-template-preview";
import { cn } from "@/lib/utils";

function ProblemList({
  ariaLabel,
  problems,
  isError,
}: {
  ariaLabel: string;
  problems: string[];
  isError: boolean;
}) {
  if (problems.length === 0) {
    return null;
  }

  const ProblemIcon = isError ? CircleXIcon : CircleAlertIcon;

  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "grid gap-1 rounded-md border p-3 text-xs",
        isError
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-warning/40 bg-warning/5",
      )}
    >
      {problems.map((problemText) => (
        <li key={problemText} className="flex gap-2">
          <ProblemIcon
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {problemText}
        </li>
      ))}
    </ul>
  );
}

/** The message picker and the rendered request, with errors and warnings (WH-08.4). */
export function TemplatePreview({
  templatePreview,
  contentType,
}: {
  templatePreview: ReturnType<typeof useTemplatePreview>;
  contentType: string;
}) {
  const pickerId = React.useId();
  const { pickedOption, setPickedOption, messageOptions, previewQuery } =
    templatePreview;
  const renderResult = previewQuery.data;

  return (
    <section aria-label="Preview" className="grid min-w-0 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={pickerId}>Preview with</Label>
        <Select value={pickedOption} onValueChange={setPickedOption}>
          <SelectTrigger id={pickerId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={sampleOption}>Built-in sample</SelectItem>
            {messageOptions.map((messageOption) => (
              <SelectItem
                key={messageOption.optionValue}
                value={messageOption.optionValue}
              >
                {messageOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {previewQuery.isPending && <Skeleton className="h-40 w-full" />}
      {previewQuery.isError && (
        <p className="text-sm text-destructive">
          Could not render the preview.
        </p>
      )}
      {renderResult !== undefined && (
        <>
          <ProblemList
            ariaLabel="Preview errors"
            problems={renderResult.errors}
            isError
          />
          <ProblemList
            ariaLabel="Preview warnings"
            problems={renderResult.warnings}
            isError={false}
          />
          <HttpHeadersList
            title="Rendered headers"
            headers={renderResult.headers}
          />
          <HttpBodyView
            title="Rendered body"
            bodyText={renderResult.body}
            contentType={contentType}
          />
        </>
      )}
    </section>
  );
}
