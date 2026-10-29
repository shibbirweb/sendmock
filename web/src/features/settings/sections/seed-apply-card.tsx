import { CheckCircle2Icon, CircleAlertIcon, UploadIcon } from "lucide-react";
import { OperationButton } from "@/features/availability/operation-button";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  useApplySeed,
  useValidateSeed,
} from "@/lib/api/hooks/use-seed-queries";
import type { SeedValidation } from "@/lib/api/types";

function SeedValidationResult({
  seedValidation,
}: {
  seedValidation: SeedValidation;
}) {
  if (!seedValidation.is_valid) {
    return (
      <div className="grid gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium text-destructive">
          <CircleAlertIcon className="size-4" />
          {seedValidation.errors.length} problem
          {seedValidation.errors.length === 1 ? "" : "s"} found
        </p>
        <ul aria-label="Seed errors" className="grid gap-0.5 font-mono text-xs">
          {seedValidation.errors.map((seedError) => (
            <li key={`${seedError.line}-${seedError.message}`}>
              Line {seedError.line}: {seedError.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-success">
        <CheckCircle2Icon className="size-4" />
        The file is valid
      </p>
      <ul
        aria-label="Seed summary"
        className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground"
      >
        {seedValidation.summary.map((summaryItem) => (
          <li key={summaryItem.item_kind}>
            {summaryItem.item_count} x {summaryItem.item_kind}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Upload or paste a seed file, validate it, then apply it (PL-04.6). */
export function SeedApplyCard() {
  const fieldId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [seedToml, setSeedToml] = React.useState("");
  const [isConfirmOpen, setConfirmOpen] = React.useState(false);
  const validateSeed = useValidateSeed();
  const applySeed = useApplySeed();
  const seedValidation = validateSeed.data;
  const isValidated =
    seedValidation?.is_valid === true && validateSeed.variables === seedToml;

  return (
    <SettingsSectionCard
      title="Apply a seed file"
      description="Validate first; applying upserts every item in the file by name or SID."
    >
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={fieldId}>Seed file (TOML)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".toml,text/plain"
            className="hidden"
            aria-label="Upload a seed file"
            onChange={(changeEvent) => {
              const uploadedFile = changeEvent.target.files?.[0];
              void uploadedFile?.text().then((fileText) => {
                setSeedToml(fileText);
                validateSeed.reset();
              });
            }}
          />
        </div>
        <Textarea
          id={fieldId}
          rows={8}
          className="font-mono text-xs"
          placeholder={
            '[[numbers]]\nnumber = "+15550001111"\nlabel = "Support line"'
          }
          value={seedToml}
          onChange={(changeEvent) => {
            setSeedToml(changeEvent.target.value);
          }}
        />
      </div>
      {seedValidation !== undefined && (
        <SeedValidationResult seedValidation={seedValidation} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={seedToml.trim() === "" || validateSeed.isPending}
          onClick={() => validateSeed.mutate(seedToml)}
        >
          Validate
        </Button>
        <OperationButton
          operationKey="POST /api/v1/seed/apply"
          actionName="Apply"
          type="button"
          disabled={!isValidated || applySeed.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Apply
        </OperationButton>
      </div>
      <ConfirmActionDialog
        isOpen={isConfirmOpen}
        title="Apply this seed file?"
        consequence="Items in the file are created or updated by name or SID. Items not in the file are kept."
        confirmLabel="Apply"
        onConfirm={() => {
          applySeed.mutate(seedToml, {
            onSuccess: () => {
              toast("Seed file applied");
              setSeedToml("");
              validateSeed.reset();
            },
            onError: () => {
              toast.error("Could not apply the seed file");
            },
          });
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </SettingsSectionCard>
  );
}
