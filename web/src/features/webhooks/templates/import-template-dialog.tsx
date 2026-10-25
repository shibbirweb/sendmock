import * as React from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/api-client";
import { useImportTemplate } from "@/lib/api/hooks/use-webhook-template-queries";
import type {
  TemplateImportRequest,
  WebhookTemplateSummary,
} from "@/lib/api/types";

/**
 * Imports an exported template file, TOML or JSON, or pasted text (WH-09.3).
 * When the id is taken it asks to replace the template or import a copy.
 * Mount it when opening.
 */
export function ImportTemplateDialog({
  onImported,
  onClose,
}: {
  onImported: (importedTemplate: WebhookTemplateSummary) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const importTemplate = useImportTemplate();
  const [fileText, setFileText] = React.useState("");
  const [importError, setImportError] = React.useState<string | undefined>();
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(
    null,
  );

  const sendImport = (onConflict?: TemplateImportRequest["on_conflict"]) => {
    importTemplate.mutate(
      { file_text: fileText, on_conflict: onConflict },
      {
        onSuccess: (importedTemplate) => {
          toast("Template imported", { description: importedTemplate.name });
          onImported(importedTemplate);
        },
        onError: (requestError) => {
          if (
            requestError instanceof ApiError &&
            requestError.errorCode === "template_exists"
          ) {
            setConflictMessage(requestError.message);
            return;
          }
          setImportError(
            requestError instanceof ApiError
              ? requestError.message
              : "Could not import the template",
          );
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import a template</DialogTitle>
          <DialogDescription>
            A <code>.sendmock-template.toml</code> or JSON file exported from
            SendMock, or its text.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4">
          <FormField label="File" fieldId={`${fieldIdPrefix}-file`}>
            <Input
              id={`${fieldIdPrefix}-file`}
              type="file"
              accept=".toml,.json,text/plain,application/json"
              onChange={(changeEvent) => {
                const pickedFile = changeEvent.target.files?.[0];
                if (pickedFile !== undefined) {
                  void pickedFile.text().then(setFileText);
                }
              }}
            />
          </FormField>
          <FormField
            label="Template text"
            fieldId={`${fieldIdPrefix}-text`}
            errorMessage={importError}
          >
            <Textarea
              id={`${fieldIdPrefix}-text`}
              rows={10}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={
                'id = "custom.my_template"\nname = "My template"\n...'
              }
              value={fileText}
              aria-invalid={importError !== undefined}
              onChange={(changeEvent) => {
                setFileText(changeEvent.target.value);
                setImportError(undefined);
                setConflictMessage(null);
              }}
            />
          </FormField>
          {conflictMessage !== null && (
            <div
              role="alert"
              className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm"
            >
              <p>{conflictMessage}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendImport("replace")}
                >
                  Replace it
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendImport("copy")}
                >
                  Import as copy
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={fileText.trim() === "" || importTemplate.isPending}
            onClick={() => {
              sendImport();
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
