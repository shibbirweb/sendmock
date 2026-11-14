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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatchUrl } from "@/features/http/use-catch-url";
import { ApiError } from "@/lib/api/api-client";
import { useCreateHttpBin } from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpBin, HttpBinPreset } from "@/lib/api/types";
import { findHttpBinPreset, httpBinPresets } from "@/lib/http/http-bin-presets";
import { validateHttpBinName } from "@/lib/http/validate-http-bin";

const noPreset = "none";

/** A bin with a name and an optional preset that sets its reply (HC-01.6). Mount when opening. */
export function NewBinDialog({
  httpBins,
  onCreated,
  onClose,
}: {
  httpBins: HttpBin[];
  onCreated: (createdBin: HttpBin) => void;
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const createHttpBin = useCreateHttpBin();
  const [binName, setBinName] = React.useState("");
  const [preset, setPreset] = React.useState<HttpBinPreset | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const catchUrl = useCatchUrl(binName === "" ? "<name>" : binName);

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
            const binInput = { name: binName.trim(), preset };
            const validationError = validateHttpBinName(binInput, httpBins);
            setNameError(validationError);
            if (validationError !== null) {
              return;
            }
            createHttpBin.mutate(binInput, {
              onSuccess: (createdBin) => {
                toast(`Bin ${createdBin.name} added`);
                onCreated(createdBin);
              },
              onError: (requestError) => {
                setNameError(
                  requestError instanceof ApiError
                    ? requestError.message
                    : "Could not add the bin",
                );
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New bin</DialogTitle>
            <DialogDescription>
              Requests to its catch URL are kept here and answered with its
              reply.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="Name"
            fieldId={`${fieldIdPrefix}-name`}
            hint={catchUrl}
            errorMessage={nameError ?? undefined}
          >
            <Input
              id={`${fieldIdPrefix}-name`}
              className="font-mono text-sm"
              placeholder="slack"
              value={binName}
              aria-invalid={nameError !== null}
              onChange={(changeEvent) => {
                setBinName(changeEvent.target.value.toLowerCase());
              }}
            />
          </FormField>
          <FormField
            label="Preset"
            fieldId={`${fieldIdPrefix}-preset`}
            hint={
              findHttpBinPreset(preset)?.description ??
              'Answers 200 {"ok":true}.'
            }
          >
            <Select
              value={preset ?? noPreset}
              onValueChange={(selectedPreset) => {
                setPreset(
                  selectedPreset === noPreset
                    ? null
                    : (selectedPreset as HttpBinPreset),
                );
              }}
            >
              <SelectTrigger id={`${fieldIdPrefix}-preset`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noPreset}>None</SelectItem>
                {httpBinPresets.map((presetDefinition) => (
                  <SelectItem
                    key={presetDefinition.preset}
                    value={presetDefinition.preset}
                  >
                    {presetDefinition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createHttpBin.isPending}>
              Add bin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
