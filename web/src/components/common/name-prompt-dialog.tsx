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
import { Input } from "@/components/ui/input";

/** Asks for one name: saving, renaming or naming a copy. Mount it when opening. */
export function NamePromptDialog({
  title,
  description,
  confirmLabel,
  initialName,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  initialName: string;
  isSubmitting: boolean;
  onSubmit: (enteredName: string) => void;
  onClose: () => void;
}) {
  const nameFieldId = React.useId();
  const [enteredName, setEnteredName] = React.useState(initialName);
  const [nameError, setNameError] = React.useState<string | undefined>();

  return (
    <Dialog
      open
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            // React passes submit up through the portal; keep it from saving an outer form.
            submitEvent.stopPropagation();
            if (enteredName.trim() === "") {
              setNameError("Enter a name");
              return;
            }
            onSubmit(enteredName.trim());
          }}
        >
          <FormField
            label="Name"
            fieldId={nameFieldId}
            errorMessage={nameError}
          >
            <Input
              id={nameFieldId}
              value={enteredName}
              aria-invalid={nameError !== undefined}
              onChange={(changeEvent) => {
                setEnteredName(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
