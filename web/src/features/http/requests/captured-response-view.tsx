import { HttpBodyView } from "@/components/common/http-body-view";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import type { CapturedHttpRequest } from "@/lib/api/types";

function describeAnswer(capturedRequest: CapturedHttpRequest): string {
  if (capturedRequest.is_simulated_failure) {
    return `Simulated failure of rule ${capturedRequest.matched_rule_name ?? ""}`;
  }

  return capturedRequest.matched_rule_name === null
    ? "Default reply"
    : `Rule: ${capturedRequest.matched_rule_name}`;
}

/** What SendMock answered and which rule produced it (HC-01.7). */
export function CapturedResponseView({
  capturedRequest,
}: {
  capturedRequest: CapturedHttpRequest;
}) {
  return (
    <div className="grid gap-3">
      <p data-testid="answered-by" className="flex items-center gap-2 text-sm">
        <HttpStatusBadge statusCode={capturedRequest.response_status} />
        {describeAnswer(capturedRequest)}
      </p>
      <HttpHeadersList
        title="Response headers"
        headers={capturedRequest.response_headers}
      />
      <HttpBodyView
        title="Response body"
        bodyText={capturedRequest.response_body}
        contentType={capturedRequest.response_headers["content-type"] ?? null}
      />
    </div>
  );
}
