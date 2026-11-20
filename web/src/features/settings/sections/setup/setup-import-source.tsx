import { UploadIcon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  SetupImportFields,
  SetupSourceKind,
} from "@/features/settings/sections/setup/use-setup-import-form";

function SetupTextField({
  setupText,
  onChange,
}: {
  setupText: string;
  onChange: (nextSetupText: string) => void;
}) {
  const fieldId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>Setup file</Label>
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
          accept=".toml,.json,.yaml,.yml,text/plain,application/json"
          className="hidden"
          aria-label="Upload a setup file"
          onChange={(changeEvent) => {
            void changeEvent.target.files?.[0]?.text().then(onChange);
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
        value={setupText}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        TOML, JSON or YAML; the format is read from the text.
      </p>
    </div>
  );
}

function SetupUrlFields({
  importFields,
  onChange,
}: {
  importFields: SetupImportFields;
  onChange: (fieldChanges: Partial<SetupImportFields>) => void;
}) {
  const fieldIdPrefix = React.useId();

  return (
    <div className="grid gap-3">
      <FormField
        label="URL"
        fieldId={`${fieldIdPrefix}-url`}
        hint="An https:// address, such as a raw file in a repository; plain http:// only on this machine or a private network. At most 1 MB."
      >
        <Input
          id={`${fieldIdPrefix}-url`}
          type="url"
          placeholder="https://example.com/sendmock.setup.toml"
          value={importFields.url}
          onChange={(changeEvent) =>
            onChange({ url: changeEvent.target.value })
          }
        />
      </FormField>
      <FormField
        label="SHA-256 (optional)"
        fieldId={`${fieldIdPrefix}-sha256`}
        hint="When given, a download with another checksum is refused."
      >
        <Input
          id={`${fieldIdPrefix}-sha256`}
          className="font-mono text-xs"
          value={importFields.sha256}
          onChange={(changeEvent) =>
            onChange({ sha256: changeEvent.target.value })
          }
        />
      </FormField>
      <FormField
        label="Headers (optional)"
        fieldId={`${fieldIdPrefix}-headers`}
        hint="One per line, such as Authorization: Bearer ...; never shown or logged."
      >
        <Textarea
          id={`${fieldIdPrefix}-headers`}
          rows={2}
          className="font-mono text-xs"
          value={importFields.headerLines}
          onChange={(changeEvent) =>
            onChange({ headerLines: changeEvent.target.value })
          }
        />
      </FormField>
    </div>
  );
}

/** Where the setup comes from: pasted or uploaded text, or a URL (PL-18.7). */
export function SetupImportSource({
  importFields,
  onChange,
}: {
  importFields: SetupImportFields;
  onChange: (fieldChanges: Partial<SetupImportFields>) => void;
}) {
  return (
    <div className="grid gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Import from"
        value={importFields.sourceKind}
        onValueChange={(selectedSourceKind) => {
          if (selectedSourceKind) {
            onChange({ sourceKind: selectedSourceKind as SetupSourceKind });
          }
        }}
        className="w-full sm:w-72"
      >
        <ToggleGroupItem value="text" className="flex-1 text-xs">
          File or text
        </ToggleGroupItem>
        <ToggleGroupItem value="url" className="flex-1 text-xs">
          URL
        </ToggleGroupItem>
      </ToggleGroup>
      {importFields.sourceKind === "text" ? (
        <SetupTextField
          setupText={importFields.setupText}
          onChange={(nextSetupText) => onChange({ setupText: nextSetupText })}
        />
      ) : (
        <SetupUrlFields importFields={importFields} onChange={onChange} />
      )}
    </div>
  );
}
