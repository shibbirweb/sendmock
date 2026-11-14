import { SendIcon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { HttpStatusBadge } from "@/components/common/http-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-client";
import { useForwardHttpRequest } from "@/lib/api/hooks/use-http-catcher-queries";
import type { CapturedHttpRequest, HttpForwardResult } from "@/lib/api/types";
import { formatDurationMs } from "@/lib/format/format-values";
import { httpUrlError, isHttpUrl } from "@/lib/numbers/validate-webhook-url";

const lastForwardUrlKey = "sendmock.http.forward-url";

function readLastForwardUrl(): string {
  try {
    return localStorage.getItem(lastForwardUrlKey) ?? "";
  } catch {
    return "";
  }
}

function rememberForwardUrl(forwardUrl: string) {
  try {
    localStorage.setItem(lastForwardUrlKey, forwardUrl);
  } catch {
    // Storage can be blocked; the field just starts empty next time.
  }
}

/** Resends the captured request to a real or local URL (HC-01.5). Mount when opening. */
export function ForwardRequestDialog({
  capturedRequest,
  onClose,
}: {
  capturedRequest: CapturedHttpRequest;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const forwardHttpRequest = useForwardHttpRequest();
  const [forwardUrl, setForwardUrl] = React.useState(readLastForwardUrl);
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [forwardResult, setForwardResult] =
    React.useState<HttpForwardResult | null>(null);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            const trimmedUrl = forwardUrl.trim();
            if (!isHttpUrl(trimmedUrl)) {
              setUrlError(httpUrlError);
              return;
            }
            setUrlError(null);
            rememberForwardUrl(trimmedUrl);
            forwardHttpRequest.mutate(
              { requestId: capturedRequest.id, url: trimmedUrl },
              {
                onSuccess: setForwardResult,
                onError: (requestError) => {
                  setUrlError(
                    requestError instanceof ApiError
                      ? requestError.message
                      : "Could not forward the request",
                  );
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Forward to URL</DialogTitle>
            <DialogDescription>
              Sends the same method, headers and body to another URL.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="URL"
            fieldId={`${fieldIdPrefix}-url`}
            errorMessage={urlError ?? undefined}
          >
            <Input
              id={`${fieldIdPrefix}-url`}
              className="font-mono text-xs"
              placeholder="http://localhost:3000/hooks/slack"
              value={forwardUrl}
              aria-invalid={urlError !== null}
              onChange={(changeEvent) => {
                setForwardUrl(changeEvent.target.value);
              }}
            />
          </FormField>
          {forwardResult !== null && (
            <p
              data-testid="forward-result"
              className="flex items-center gap-2 rounded-md border p-3 text-sm"
            >
              <HttpStatusBadge statusCode={forwardResult.status_code} />
              Answered in {formatDurationMs(forwardResult.duration_ms)}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {forwardResult === null ? "Cancel" : "Done"}
            </Button>
            <Button type="submit" disabled={forwardHttpRequest.isPending}>
              <SendIcon />
              Forward
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
