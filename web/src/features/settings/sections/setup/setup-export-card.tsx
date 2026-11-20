import { DownloadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OperationButton } from "@/features/availability/operation-button";
import {
  buildSetupFileName,
  findSetupContentType,
  minimumPassphraseLength,
  setupFileFormats,
  setupSectionGroups,
} from "@/features/settings/sections/setup/setup-file-formats";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { ApiError } from "@/lib/api/api-client";
import { useExportSetup } from "@/lib/api/hooks/use-setup-queries";
import type { SetupFileFormat } from "@/lib/api/types";
import { downloadTextFile } from "@/lib/files/download-text-file";

type SecretsChoice = "references" | "encrypted";

const allGroupNames = setupSectionGroups.map(
  (sectionGroup) => sectionGroup.groupName,
);

function SectionChoices({
  checkedGroupNames,
  onChange,
}: {
  checkedGroupNames: string[];
  onChange: (nextGroupNames: string[]) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Sections</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {setupSectionGroups.map((sectionGroup) => {
          const checkboxId = `${fieldIdPrefix}-${sectionGroup.groupName}`;

          return (
            <div
              key={sectionGroup.groupName}
              className="flex items-center gap-2"
            >
              <Checkbox
                id={checkboxId}
                checked={checkedGroupNames.includes(sectionGroup.groupName)}
                onCheckedChange={(checkedState) => {
                  onChange(
                    checkedState === true
                      ? [...checkedGroupNames, sectionGroup.groupName]
                      : checkedGroupNames.filter(
                          (groupName) => groupName !== sectionGroup.groupName,
                        ),
                  );
                }}
              />
              <Label htmlFor={checkboxId} className="font-normal">
                {sectionGroup.label}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Export the configuration as a setup file in TOML, JSON or YAML (PL-18.1, PL-18.5, PL-18.6). */
export function SetupExportCard() {
  const passphraseFieldId = React.useId();
  const [setupFormat, setSetupFormat] = React.useState<SetupFileFormat>("toml");
  const [checkedGroupNames, setCheckedGroupNames] =
    React.useState<string[]>(allGroupNames);
  const [secretsChoice, setSecretsChoice] =
    React.useState<SecretsChoice>("references");
  const [passphrase, setPassphrase] = React.useState("");
  const exportSetup = useExportSetup();
  const isEncrypted = secretsChoice === "encrypted";
  const isPassphraseShort =
    isEncrypted && passphrase.length < minimumPassphraseLength;
  const isEverySection = checkedGroupNames.length === allGroupNames.length;

  const startExport = () => {
    exportSetup.mutate(
      {
        format: setupFormat,
        only: isEverySection ? [] : checkedGroupNames,
        include_secrets: isEncrypted,
        passphrase: isEncrypted ? passphrase : null,
      },
      {
        onSuccess: (setupText) => {
          downloadTextFile(
            setupText,
            buildSetupFileName(setupFormat),
            findSetupContentType(setupFormat),
          );
          toast("Setup exported", {
            description: isEncrypted
              ? "Secrets are encrypted; importing asks for the same passphrase."
              : "Secrets are written as ${ENV_VAR} references.",
          });
        },
        onError: (exportError) => {
          toast.error(
            exportError instanceof ApiError
              ? exportError.message
              : "Could not export the setup",
          );
        },
      },
    );
  };

  return (
    <SettingsSectionCard
      title="Export a setup"
      description="Everything you configured, without traffic, in one file to share with your team or carry to another machine."
    >
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Format</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Format"
          value={setupFormat}
          onValueChange={(selectedFormat) => {
            if (selectedFormat) {
              setSetupFormat(selectedFormat as SetupFileFormat);
            }
          }}
          className="w-full sm:w-72"
        >
          {setupFileFormats.map((setupFileFormat) => (
            <ToggleGroupItem
              key={setupFileFormat.setupFormat}
              value={setupFileFormat.setupFormat}
              className="flex-1 text-xs"
            >
              {setupFileFormat.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <SectionChoices
        checkedGroupNames={checkedGroupNames}
        onChange={setCheckedGroupNames}
      />
      <RadioCardGroup<SecretsChoice>
        legend="Secrets"
        selectedValue={secretsChoice}
        onSelect={setSecretsChoice}
        options={[
          {
            value: "references",
            label: "As ${ENV_VAR} references",
            description:
              "To share: the file holds no secret, and whoever imports it sets the variables.",
          },
          {
            value: "encrypted",
            label: "Encrypted with a passphrase",
            description:
              "For your own machine: each secret is encrypted, and the import asks for the passphrase.",
          },
        ]}
      />
      {isEncrypted && (
        <FormField
          label="Passphrase"
          fieldId={passphraseFieldId}
          hint={`At least ${minimumPassphraseLength} characters. SendMock does not keep it; without it the secrets cannot be opened.`}
        >
          <Input
            id={passphraseFieldId}
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(changeEvent) => setPassphrase(changeEvent.target.value)}
          />
        </FormField>
      )}
      <div>
        <OperationButton
          operationKey="POST /api/v1/setup/export"
          actionName="Export"
          type="button"
          disabled={
            exportSetup.isPending ||
            isPassphraseShort ||
            checkedGroupNames.length === 0
          }
          onClick={startExport}
        >
          <DownloadIcon />
          Export {buildSetupFileName(setupFormat)}
        </OperationButton>
      </div>
    </SettingsSectionCard>
  );
}
