import { CircleAlertIcon, CircleXIcon } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
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
import type { useEndpointRequestPreview } from "@/features/webhooks/endpoints/sheet/request/use-endpoint-request-preview";
import { sampleOption } from "@/features/webhooks/templates/detail/use-template-preview";
import type { RenderProblem, WebhookEndpointInput } from "@/lib/api/types";
import {
  describeProblemSource,
  findRequestPart,
  type RequestPart,
} from "@/lib/webhooks/describe-problem-source";
import { cn } from "@/lib/utils";

const partTitles: Record<RequestPart, string> = {
  url: "URL",
  headers: "Headers",
  body: "Body",
};

/** The problems of one part, shown right under it (WH-07.15). */
function PartProblems({
  requestPart,
  problems,
  renderedInput,
}: {
  requestPart: RequestPart;
  problems: RenderProblem[];
  renderedInput: WebhookEndpointInput;
}) {
  const partProblems = problems.filter(
    (renderProblem) => findRequestPart(renderProblem.source) === requestPart,
  );
  if (partProblems.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={`${partTitles[requestPart]} problems`}
      className="grid gap-1 text-xs"
    >
      {partProblems.map((renderProblem) => {
        const isError = renderProblem.severity === "error";
        const ProblemIcon = isError ? CircleXIcon : CircleAlertIcon;
        return (
          <li
            key={`${renderProblem.source}-${renderProblem.line}-${renderProblem.column}-${renderProblem.message}`}
            className={cn(
              "flex gap-2 rounded-md border px-2 py-1.5",
              isError
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-warning/40 bg-warning/5",
            )}
          >
            <ProblemIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span>
              <span className="font-medium">
                {describeProblemSource(renderProblem, renderedInput)}:
              </span>{" "}
              {renderProblem.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The message picker and the rendered method, URL, headers and body. */
export function EndpointRequestPreview({
  requestPreview,
}: {
  requestPreview: ReturnType<typeof useEndpointRequestPreview>;
}) {
  const pickerId = React.useId();
  const {
    pickedOption,
    setPickedOption,
    messageOptions,
    previewQuery,
    renderedInput,
  } = requestPreview;
  const previewResult = previewQuery.data;
  const problems = previewResult?.problems ?? [];

  return (
    <section aria-label="Request preview" className="grid min-w-0 gap-3">
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
      {previewResult !== undefined && (
        <>
          <div className="grid gap-1.5">
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 font-mono text-xs">
              <span className="font-semibold">{previewResult.method}</span>
              <span
                data-testid="rendered-url"
                className="min-w-0 flex-1 break-all"
              >
                {previewResult.url === "" ? (
                  <span className="font-sans text-muted-foreground">
                    Set the URL on the General tab.
                  </span>
                ) : (
                  previewResult.url
                )}
              </span>
              <CopyButton
                copyText={previewResult.url}
                label="Copy rendered URL"
                className="size-6"
              />
            </div>
            <PartProblems
              requestPart="url"
              problems={problems}
              renderedInput={renderedInput}
            />
          </div>
          <div className="grid gap-1.5">
            <HttpHeadersList
              title="Rendered headers"
              headers={previewResult.headers}
            />
            <PartProblems
              requestPart="headers"
              problems={problems}
              renderedInput={renderedInput}
            />
          </div>
          <div className="grid gap-1.5">
            <HttpBodyView
              title="Rendered body"
              bodyText={previewResult.body}
              contentType={previewResult.headers["content-type"] ?? null}
            />
            <PartProblems
              requestPart="body"
              problems={problems}
              renderedInput={renderedInput}
            />
          </div>
        </>
      )}
    </section>
  );
}
