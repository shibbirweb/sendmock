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

/** Names a delivery to keep as a bookmark on the Saved screen. */
export function SaveDeliveryDialog({
  isOpen,
  suggestedName,
  isSaving,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  suggestedName: string;
  isSaving: boolean;
  onSave: (savedName: string) => void;
  onClose: () => void;
}) {
  const nameFieldId = React.useId();
  const [savedName, setSavedName] = React.useState(suggestedName);
  const [nameError, setNameError] = React.useState<string | undefined>();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save this delivery</DialogTitle>
          <DialogDescription>
            Saved deliveries are kept through pruning and reset, and can be sent
            again later.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            if (savedName.trim() === "") {
              setNameError("Enter a name");
              return;
            }
            onSave(savedName.trim());
          }}
        >
          <FormField
            label="Name"
            fieldId={nameFieldId}
            errorMessage={nameError}
          >
            <Input
              id={nameFieldId}
              value={savedName}
              aria-invalid={nameError !== undefined}
              onChange={(changeEvent) => {
                setSavedName(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
