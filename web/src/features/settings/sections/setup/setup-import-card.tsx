import { EyeIcon, FileInputIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationButton } from "@/features/availability/operation-button";
import {
  buildSetupFileName,
  findSetupContentType,
} from "@/features/settings/sections/setup/setup-file-formats";
import { SetupImportSource } from "@/features/settings/sections/setup/setup-import-source";
import { SetupPreview } from "@/features/settings/sections/setup/setup-preview";
import { useSetupImportForm } from "@/features/settings/sections/setup/use-setup-import-form";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { ApiError } from "@/lib/api/api-client";
import { useMigrateSetup } from "@/lib/api/hooks/use-setup-queries";
import type { SetupImportMode, SetupValidation } from "@/lib/api/types";
import { downloadTextFile } from "@/lib/files/download-text-file";

function describeImport(setupPreview: SetupValidation | undefined): string {
  const removedCount = setupPreview?.removed_count ?? 0;
  if (removedCount > 0) {
    return `This removes ${removedCount} item${removedCount === 1 ? "" : "s"} the file does not hold and puts the settings it leaves out back to their defaults, then adds and updates the rest.`;
  }

  return "Items in the file are added or updated by name. Nothing else is removed.";
}

function readErrorMessage(requestError: unknown, fallbackMessage: string) {
  return requestError instanceof ApiError
    ? requestError.message
    : fallbackMessage;
}

/** Import a setup from a file, pasted text or a URL, after a preview (PL-18.7, PL-18.8). */
export function SetupImportCard() {
  const passphraseFieldId = React.useId();
  const [isConfirmOpen, setConfirmOpen] = React.useState(false);
  const setupImportForm = useSetupImportForm();
  const migrateSetup = useMigrateSetup();
  const { importFields, changeFields, setupPreview } = setupImportForm;

  const downloadUpgradedCopy = () => {
    migrateSetup.mutate(
      { setup_text: importFields.setupText, format: setupPreview?.format },
      {
        onSuccess: (migratedText) => {
          const setupFormat = setupPreview?.format ?? "toml";
          downloadTextFile(
            migratedText,
            buildSetupFileName(setupFormat),
            findSetupContentType(setupFormat),
          );
        },
        onError: (migrateError) => {
          toast.error(
            readErrorMessage(migrateError, "Could not upgrade the file"),
          );
        },
      },
    );
  };

  return (
    <SettingsSectionCard
      title="Import a setup"
      description="Preview first: the import shows what it adds, changes and removes, and an invalid file changes nothing."
    >
      <SetupImportSource importFields={importFields} onChange={changeFields} />
      <RadioCardGroup<SetupImportMode>
        legend="Import as"
        selectedValue={importFields.importMode}
        onSelect={(importMode) => changeFields({ importMode })}
        options={[
          {
            value: "merge",
            label: "Merge",
            description:
              "Add and update what the file holds by name; keep everything else.",
          },
          {
            value: "replace",
            label: "Replace",
            description:
              "Also remove what the file does not hold, after a confirmation with the count.",
          },
        ]}
      />
      <FormField
        label="Passphrase"
        fieldId={passphraseFieldId}
        hint="Only for a file exported with encrypted secrets."
      >
        <Input
          id={passphraseFieldId}
          type="password"
          autoComplete="off"
          value={importFields.passphrase}
          onChange={(changeEvent) =>
            changeFields({ passphrase: changeEvent.target.value })
          }
        />
      </FormField>
      {setupImportForm.previewError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {readErrorMessage(
            setupImportForm.previewError,
            "Could not read the setup",
          )}
        </p>
      )}
      {setupPreview !== undefined && (
        <SetupPreview
          setupPreview={setupPreview}
          onDownloadUpgradedCopy={
            importFields.sourceKind === "text" ? downloadUpgradedCopy : null
          }
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!setupImportForm.hasSource || setupImportForm.isPreviewing}
          onClick={setupImportForm.startPreview}
        >
          <EyeIcon />
          Preview
        </Button>
        <OperationButton
          operationKey="POST /api/v1/setup/import"
          actionName="Import"
          type="button"
          disabled={!setupImportForm.canImport || setupImportForm.isImporting}
          onClick={() => setConfirmOpen(true)}
        >
          <FileInputIcon />
          Import
        </OperationButton>
      </div>
      <ConfirmActionDialog
        isOpen={isConfirmOpen}
        title={
          importFields.importMode === "replace"
            ? "Replace the configuration with this setup?"
            : "Import this setup?"
        }
        consequence={describeImport(setupPreview)}
        confirmLabel={
          importFields.importMode === "replace" ? "Replace" : "Import"
        }
        isDestructive={(setupPreview?.removed_count ?? 0) > 0}
        onConfirm={() => {
          setupImportForm.startImport({
            onSuccess: () => toast("Setup imported"),
            onError: (importError) => {
              toast.error(
                readErrorMessage(importError, "Could not import the setup"),
              );
            },
          });
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </SettingsSectionCard>
  );
}
