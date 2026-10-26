import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/api-client";
import { useSendConnectionRequest } from "@/lib/api/hooks/use-automation-queries";
import type { SnippetHeader } from "@/lib/settings/build-http-post-snippet";
import type { JsonValue } from "@/lib/settings/json-literals";

/** Sends the edited email or SMS call to SendMock itself, as the snippets would (UI-11.6). */
export function SendRequestButton({
  apiPath,
  requestBody,
  requestHeaders,
  isDisabled,
}: {
  apiPath: "/send" | "/sms";
  requestBody: JsonValue;
  requestHeaders: SnippetHeader[];
  isDisabled: boolean;
}) {
  const sendRequest = useSendConnectionRequest();
  const resultText = sendRequest.isSuccess
    ? `Sent: stored as ${sendRequest.data.id}`
    : sendRequest.error instanceof ApiError
      ? `Refused: ${sendRequest.error.message}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isDisabled || sendRequest.isPending}
        onClick={() => {
          sendRequest.mutate({
            apiPath,
            requestBody,
            requestHeaders: Object.fromEntries(
              requestHeaders.map((requestHeader) => [
                requestHeader.headerName,
                requestHeader.headerValue,
              ]),
            ),
          });
        }}
      >
        <SendIcon />
        Send this request
      </Button>
      {resultText !== null && (
        <p role="status" className="text-xs text-muted-foreground">
          {resultText}
        </p>
      )}
    </div>
  );
}
