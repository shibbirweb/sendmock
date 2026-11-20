import {
  CheckCircle2Icon,
  CircleAlertIcon,
  DownloadIcon,
  LockKeyholeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  SetupSectionChange,
  SetupValidation,
  SetupValidationError,
} from "@/lib/api/types";

function describeSetupError(setupError: SetupValidationError): string {
  if (setupError.line !== null) {
    return `Line ${setupError.line}: ${setupError.message}`;
  }

  return setupError.location === null
    ? setupError.message
    : `${setupError.location}: ${setupError.message}`;
}

function SetupErrors({ setupErrors }: { setupErrors: SetupValidationError[] }) {
  return (
    <div className="grid gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-destructive">
        <CircleAlertIcon className="size-4" />
        {setupErrors.length} problem{setupErrors.length === 1 ? "" : "s"} found;
        nothing is imported
      </p>
      <ul aria-label="Setup errors" className="grid gap-0.5 font-mono text-xs">
        {setupErrors.map((setupError) => (
          <li key={describeSetupError(setupError)}>
            {describeSetupError(setupError)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionChangeRow({
  sectionChange,
}: {
  sectionChange: SetupSectionChange;
}) {
  const changeGroups = [
    { verb: "Adds", itemNames: sectionChange.added },
    { verb: "Changes", itemNames: sectionChange.changed },
    { verb: "Removes", itemNames: sectionChange.removed },
  ].filter((changeGroup) => changeGroup.itemNames.length > 0);

  return (
    <li className="grid gap-0.5">
      <span className="font-mono text-xs font-medium">
        {sectionChange.section}
      </span>
      {changeGroups.map((changeGroup) => (
        <span
          key={changeGroup.verb}
          className={
            changeGroup.verb === "Removes"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {changeGroup.verb} {changeGroup.itemNames.length}:{" "}
          {changeGroup.itemNames.join(", ")}
        </span>
      ))}
    </li>
  );
}

/** What the file holds and what importing it would add, change and remove (PL-18.8). */
export function SetupPreview({
  setupPreview,
  onDownloadUpgradedCopy,
}: {
  setupPreview: SetupValidation;
  /** Offered for an older file pasted or uploaded, to keep the upgraded copy (PL-18.3). */
  onDownloadUpgradedCopy: (() => void) | null;
}) {
  if (!setupPreview.is_valid) {
    return <SetupErrors setupErrors={setupPreview.errors} />;
  }
  const upgradedFromVersion = setupPreview.upgraded_from_format_version;

  return (
    <section
      aria-label="Import preview"
      className="grid gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm"
    >
      <p className="flex items-center gap-1.5 font-medium text-success">
        <CheckCircle2Icon className="size-4" />
        The file is valid ({setupPreview.format.toUpperCase()}, format{" "}
        {setupPreview.format_version})
      </p>
      {upgradedFromVersion !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            Upgraded from format {upgradedFromVersion} for this import; your
            file is not changed.
          </span>
          {onDownloadUpgradedCopy !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadUpgradedCopy}
            >
              <DownloadIcon />
              Download the upgraded copy
            </Button>
          )}
        </div>
      )}
      {setupPreview.has_encrypted_secrets && (
        <p className="flex items-center gap-1.5 text-xs">
          <LockKeyholeIcon className="size-3.5" />
          Holds encrypted secrets: the passphrase opens them.
        </p>
      )}
      <ul
        aria-label="Setup summary"
        className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground"
      >
        {setupPreview.summary.map((summaryItem) => (
          <li key={summaryItem.item_kind}>
            {summaryItem.item_count} x {summaryItem.item_kind}
          </li>
        ))}
      </ul>
      {setupPreview.changes.length === 0 ? (
        <p className="text-xs">Importing it changes nothing.</p>
      ) : (
        <ul aria-label="Changes" className="grid gap-1.5">
          {setupPreview.changes.map((sectionChange) => (
            <SectionChangeRow
              key={sectionChange.section}
              sectionChange={sectionChange}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
