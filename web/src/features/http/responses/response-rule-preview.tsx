import { CircleCheckIcon, CircleSlashIcon } from "lucide-react";
import * as React from "react";

import { HttpBodyView } from "@/components/common/http-body-view";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useCapturedHttpRequests,
  useHttpRulePreview,
} from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpResponseRule } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format/format-values";
import { readPathInBin } from "@/lib/http/match-response-rule";

const ruleDebounceMs = 300;

/**
 * Whether the rule matches a captured request of the bin (the latest by
 * default) and what it returns, as you edit (HC-02.4).
 */
export function ResponseRulePreview({
  binId,
  draftRule,
}: {
  binId: string;
  draftRule: HttpResponseRule;
}) {
  const pickerId = React.useId();
  const binRequests =
    useCapturedHttpRequests(binId).data?.pages[0]?.items ?? [];
  const [pickedRequestId, setPickedRequestId] = React.useState<string | null>(
    null,
  );
  const previewRequestId = pickedRequestId ?? binRequests[0]?.id ?? null;
  const debouncedRuleText = useDebouncedValue(
    JSON.stringify(draftRule),
    ruleDebounceMs,
  );
  const previewRequest = React.useMemo(
    () =>
      previewRequestId === null
        ? null
        : {
            rule: JSON.parse(debouncedRuleText) as HttpResponseRule,
            request_id: previewRequestId,
          },
    [debouncedRuleText, previewRequestId],
  );
  const previewResult = useHttpRulePreview(binId, previewRequest).data;

  if (binRequests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The preview needs a captured request in this bin.
      </p>
    );
  }

  return (
    <section aria-label="Rule preview" className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={pickerId}>Preview with</Label>
        <Select
          value={previewRequestId ?? ""}
          onValueChange={setPickedRequestId}
        >
          <SelectTrigger id={pickerId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {binRequests.map((capturedRequest) => (
              <SelectItem key={capturedRequest.id} value={capturedRequest.id}>
                {capturedRequest.method}{" "}
                {readPathInBin(capturedRequest.path, capturedRequest.bin_name)},{" "}
                {formatRelativeTime(capturedRequest.created_at)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {previewResult !== undefined && (
        <>
          <p
            data-testid="rule-match"
            className="flex items-center gap-2 text-sm"
          >
            {previewResult.is_match ? (
              <CircleCheckIcon
                aria-hidden="true"
                className="size-4 text-success"
              />
            ) : (
              <CircleSlashIcon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            )}
            {previewResult.is_match
              ? "This rule answers this request."
              : `Not matched: ${previewResult.mismatch_reason ?? ""}`}
          </p>
          {previewResult.problems.length > 0 && (
            <ul
              aria-label="Template problems"
              className="grid gap-1 text-xs text-destructive"
            >
              {previewResult.problems.map((problemText) => (
                <li key={problemText}>{problemText}</li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-2 text-sm">
            Returns{" "}
            <HttpStatusBadge statusCode={previewResult.response.status_code} />
          </p>
          <HttpHeadersList
            title="Rendered headers"
            headers={previewResult.response.headers}
          />
          <HttpBodyView
            title="Rendered body"
            bodyText={previewResult.response.body}
            contentType={previewResult.response.headers["content-type"] ?? null}
          />
        </>
      )}
    </section>
  );
}
