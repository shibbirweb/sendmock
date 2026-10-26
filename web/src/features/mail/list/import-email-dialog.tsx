import { useNavigate } from "@tanstack/react-router";
import { FileUpIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { FormFieldError } from "@/components/common/form-field-error";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/api-client";
import {
  type ImportedEmailKind,
  useImportEmail,
} from "@/lib/api/hooks/use-automation-queries";

const importedKindOptions = [
  {
    value: "sent" as const,
    label: "Sent by your app",
    description:
      "As if your app sent it, like the sendmail shim (POST /send/raw).",
  },
  {
    value: "incoming" as const,
    label: "Incoming to your app",
    description:
      "As a reply or new mail to your app; inbound routes deliver it.",
  },
];

/** Mail > Import .eml: store a raw message as sent or as incoming (UI-11.6). */
export function ImportEmailDialog() {
  const navigate = useNavigate();
  const importEmail = useImportEmail();
  const fieldId = React.useId();
  const [isOpen, setOpen] = React.useState(false);
  const [rawMessage, setRawMessage] = React.useState("");
  const [importedKind, setImportedKind] =
    React.useState<ImportedEmailKind>("sent");
  const errorMessage =
    importEmail.error instanceof ApiError
      ? importEmail.error.message
      : undefined;

  const readFile = async (messageFile: File | undefined) => {
    if (messageFile !== undefined) {
      setRawMessage(await messageFile.text());
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        setOpen(nextIsOpen);
        importEmail.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Import .eml">
          <FileUpIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import .eml</DialogTitle>
          <DialogDescription>
            Store a whole message, headers and all, from a file or pasted text.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            importEmail.mutate(
              { rawMessage, importedKind },
              {
                onSuccess: (importedEmail) => {
                  setOpen(false);
                  setRawMessage("");
                  toast("Email imported", {
                    action: {
                      label: "Open",
                      onClick: () => {
                        void navigate({
                          to: "/mail/$emailId",
                          params: { emailId: importedEmail.id },
                        });
                      },
                    },
                  });
                },
              },
            );
          }}
        >
          <RadioCardGroup
            legend="Store it as"
            options={importedKindOptions}
            selectedValue={importedKind}
            onSelect={setImportedKind}
          />
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId}>Message</Label>
            <Textarea
              id={fieldId}
              className="min-h-40 font-mono text-xs"
              placeholder={
                "From: app@app.test\nTo: user@example.com\nSubject: Hello\n\nHi there."
              }
              value={rawMessage}
              aria-invalid={errorMessage !== undefined}
              onChange={(changeEvent) =>
                setRawMessage(changeEvent.target.value)
              }
            />
            <FormFieldError errorMessage={errorMessage} />
          </div>
          <div>
            <Label htmlFor={`${fieldId}-file`} className="sr-only">
              Upload a .eml file
            </Label>
            <input
              id={`${fieldId}-file`}
              type="file"
              accept=".eml,message/rfc822"
              className="text-sm"
              onChange={(changeEvent) => {
                void readFile(changeEvent.target.files?.[0]);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={rawMessage.trim() === "" || importEmail.isPending}
            >
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
