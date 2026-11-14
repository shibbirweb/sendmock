import * as React from "react";

import { FormField } from "@/components/common/form-field";
import {
  fromNameValueRows,
  NameValueRowsEditor,
  toNameValueRows,
} from "@/components/common/name-value-rows-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { RecordedHttpRequest } from "@/lib/api/types";

function readJsonError(
  bodyText: string,
  headers: Record<string, string>,
): string | undefined {
  const isJsonRequest = Object.entries(headers).some(
    ([headerName, headerValue]) =>
      headerName.toLowerCase() === "content-type" &&
      headerValue.includes("json"),
  );
  if (!isJsonRequest || bodyText.trim() === "") {
    return undefined;
  }

  try {
    JSON.parse(bodyText);
    return undefined;
  } catch {
    return "The body is not valid JSON";
  }
}

function EditReplayForm({
  recordedRequest,
  isSending,
  onSend,
  onCancel,
}: {
  recordedRequest: RecordedHttpRequest;
  isSending: boolean;
  onSend: (editedRequest: {
    body: string;
    headers: Record<string, string>;
  }) => void;
  onCancel: () => void;
}) {
  const bodyFieldId = React.useId();
  const [bodyText, setBodyText] = React.useState(recordedRequest.body);
  const [headerRows, setHeaderRows] = React.useState(() =>
    toNameValueRows(recordedRequest.headers),
  );
  const [bodyError, setBodyError] = React.useState<string | undefined>();

  return (
    <form
      noValidate
      className="grid min-w-0 gap-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const editedHeaders = fromNameValueRows(headerRows);
        const jsonError = readJsonError(bodyText, editedHeaders);
        setBodyError(jsonError);
        if (jsonError === undefined) {
          onSend({ body: bodyText, headers: editedHeaders });
        }
      }}
    >
      <div className="grid max-h-[60vh] min-w-0 gap-4 overflow-y-auto pr-1">
        <FormField label="Body" fieldId={bodyFieldId} errorMessage={bodyError}>
          <Textarea
            id={bodyFieldId}
            rows={10}
            className="font-mono text-xs"
            value={bodyText}
            aria-invalid={bodyError !== undefined}
            onChange={(changeEvent) => {
              setBodyText(changeEvent.target.value);
            }}
          />
        </FormField>
        <NameValueRowsEditor
          legend="Headers"
          rowLabel="Header"
          namePlaceholder="X-Request-Id"
          emptyText="No headers."
          rows={headerRows}
          onChange={setHeaderRows}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSending}>
          Send edited request
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Edit the stored body and headers, then send them as a replay (WH-05.2). */
export function EditReplayDialog({
  recordedRequest,
  isOpen,
  isSending,
  onSend,
  onClose,
}: {
  recordedRequest: RecordedHttpRequest;
  isOpen: boolean;
  isSending: boolean;
  onSend: (editedRequest: {
    body: string;
    headers: Record<string, string>;
  }) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit and replay</DialogTitle>
          <DialogDescription>
            {recordedRequest.method} {recordedRequest.url}
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <EditReplayForm
            recordedRequest={recordedRequest}
            isSending={isSending}
            onSend={onSend}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
