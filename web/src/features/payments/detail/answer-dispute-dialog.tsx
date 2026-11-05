import * as React from "react";

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
import { Textarea } from "@/components/ui/textarea";

/** The evidence the merchant sends the bank, which puts the dispute under review (PY-07.3). */
export function AnswerDisputeDialog({
  isAnswering,
  onAnswer,
  onClose,
}: {
  isAnswering: boolean;
  onAnswer: (disputeEvidence: string) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const [evidenceText, setEvidenceText] = React.useState("");
  const [evidenceError, setEvidenceError] = React.useState<string | null>(null);

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
            const trimmedEvidence = evidenceText.trim();
            if (trimmedEvidence === "") {
              setEvidenceError("Describe the evidence you send.");
              return;
            }
            onAnswer(trimmedEvidence);
          }}
        >
          <DialogHeader>
            <DialogTitle>Answer dispute</DialogTitle>
            <DialogDescription>
              The dispute goes under review until it is won or lost.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Evidence"
            fieldId={`${fieldIdPrefix}-evidence`}
            errorMessage={evidenceError ?? undefined}
          >
            <Textarea
              id={`${fieldIdPrefix}-evidence`}
              rows={4}
              value={evidenceText}
              aria-invalid={evidenceError !== null}
              onChange={(changeEvent) => {
                setEvidenceText(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAnswering}>
              Send answer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
