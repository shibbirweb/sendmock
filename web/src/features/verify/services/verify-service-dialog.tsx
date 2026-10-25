import * as React from "react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVerifyServiceForm } from "@/features/verify/services/use-verify-service-form";
import type { VerifyService } from "@/lib/api/types";
import { verifyCodeLengthRange } from "@/lib/verify/validate-verify-service";

const codeLengthOptions = Array.from(
  { length: verifyCodeLengthRange.max - verifyCodeLengthRange.min + 1 },
  (_, optionIndex) => verifyCodeLengthRange.min + optionIndex,
);

function FieldError({ errorMessage }: { errorMessage: string | undefined }) {
  if (errorMessage === undefined) {
    return null;
  }

  return <p className="text-xs text-destructive">{errorMessage}</p>;
}

function VerifyServiceForm({
  editedService,
  onDone,
}: {
  editedService: VerifyService | null;
  onDone: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const { formValues, updateFormValues, fieldErrors, isSaving, saveService } =
    useVerifyServiceForm({ editedService, onSaved: onDone });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        saveService();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-name`}>Name</Label>
        <Input
          id={`${fieldIdPrefix}-name`}
          value={formValues.friendlyName}
          placeholder="Acme Login"
          aria-invalid={fieldErrors.friendly_name !== undefined}
          onChange={(changeEvent) => {
            updateFormValues({ friendlyName: changeEvent.target.value });
          }}
        />
        <FieldError errorMessage={fieldErrors.friendly_name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldIdPrefix}-length`}>Code length</Label>
          <Select
            value={String(formValues.codeLength)}
            onValueChange={(selectedLength) => {
              updateFormValues({ codeLength: Number(selectedLength) });
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-length`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {codeLengthOptions.map((codeLength) => (
                <SelectItem key={codeLength} value={String(codeLength)}>
                  {codeLength} digits
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errorMessage={fieldErrors.code_length} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldIdPrefix}-ttl`}>
            Expires after (minutes)
          </Label>
          <Input
            id={`${fieldIdPrefix}-ttl`}
            type="number"
            min={1}
            max={1440}
            value={formValues.ttlMinutes}
            aria-invalid={fieldErrors.ttl_seconds !== undefined}
            onChange={(changeEvent) => {
              updateFormValues({ ttlMinutes: changeEvent.target.value });
            }}
          />
          <FieldError errorMessage={fieldErrors.ttl_seconds} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-fixed`}>Fixed code (optional)</Label>
        <Input
          id={`${fieldIdPrefix}-fixed`}
          inputMode="numeric"
          className="font-mono tracking-widest"
          placeholder={"0".repeat(formValues.codeLength)}
          value={formValues.fixedCode}
          aria-invalid={fieldErrors.fixed_code !== undefined}
          aria-describedby={`${fieldIdPrefix}-fixed-hint`}
          onChange={(changeEvent) => {
            updateFormValues({ fixedCode: changeEvent.target.value });
          }}
        />
        <p
          id={`${fieldIdPrefix}-fixed-hint`}
          className="text-xs text-muted-foreground"
        >
          Leave empty for a random code. A fixed code makes tests deterministic.
        </p>
        <FieldError errorMessage={fieldErrors.fixed_code} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editedService === null ? "Create service" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create or edit a Verify service (VF-01.3). */
export function VerifyServiceDialog({
  isOpen,
  editedService,
  onOpenChange,
}: {
  isOpen: boolean;
  editedService: VerifyService | null;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editedService === null
              ? "New Verify service"
              : "Edit Verify service"}
          </DialogTitle>
          <DialogDescription>
            Apps start verifications against a service by its SID.
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <VerifyServiceForm
            key={editedService?.sid ?? "new"}
            editedService={editedService}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
