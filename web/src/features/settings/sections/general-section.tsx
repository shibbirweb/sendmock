import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  SettingsNumberField,
  SettingsSwitchRow,
} from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import { useDeleteAllEmails } from "@/lib/api/hooks/use-email-queries";
import { useDeleteAllSms } from "@/lib/api/hooks/use-sms-queries";
import { useResetToSeed } from "@/lib/api/hooks/use-system-queries";
import type { AppSettings } from "@/lib/api/types";

const retentionKeys = ["max_emails", "max_sms", "max_age_days"] as const;
const defaultMaxAgeDays = 7;

type DangerAction = "delete-emails" | "delete-sms" | "reset";

const dangerActionTexts: Record<
  DangerAction,
  {
    title: string;
    consequence: string;
    confirmLabel: string;
    doneMessage: string;
  }
> = {
  "delete-emails": {
    title: "Delete all emails?",
    consequence:
      "Every captured email, its attachments and its SMTP session link are removed. Configuration stays.",
    confirmLabel: "Delete all emails",
    doneMessage: "All emails deleted",
  },
  "delete-sms": {
    title: "Delete all SMS?",
    consequence:
      "Every captured SMS and WhatsApp message is removed. Numbers and services stay.",
    confirmLabel: "Delete all SMS",
    doneMessage: "All SMS deleted",
  },
  reset: {
    title: "Reset to seed?",
    consequence:
      "All traffic is wiped and the configuration goes back to the seed file. Changes not exported to the seed are lost.",
    confirmLabel: "Reset",
    doneMessage: "Reset to the seed state",
  },
};

function RetentionCard({ appSettings }: { appSettings: AppSettings }) {
  const sectionForm = useSettingsSectionForm(appSettings, retentionKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <SettingsSectionCard
      title="Retention"
      description="Older traffic is pruned when a limit is reached. Configuration is never pruned."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsNumberField
          label="Keep at most"
          unitLabel="emails"
          value={draftValues.max_emails}
          errorMessage={fieldErrors.max_emails}
          onValueChange={(maxEmails) => {
            updateDraft({ max_emails: maxEmails ?? 0 });
          }}
        />
        <SettingsNumberField
          label="Keep at most"
          unitLabel="SMS"
          value={draftValues.max_sms}
          errorMessage={fieldErrors.max_sms}
          onValueChange={(maxSms) => {
            updateDraft({ max_sms: maxSms ?? 0 });
          }}
        />
      </div>
      <SettingsSwitchRow
        label="Keep forever"
        description="Turn off to delete traffic after a number of days."
        isChecked={draftValues.max_age_days === null}
        onCheckedChange={(isKeptForever) => {
          updateDraft({
            max_age_days: isKeptForever ? null : defaultMaxAgeDays,
          });
        }}
      />
      {draftValues.max_age_days !== null && (
        <SettingsNumberField
          label="Delete traffic older than"
          unitLabel="days"
          value={draftValues.max_age_days}
          errorMessage={fieldErrors.max_age_days}
          onValueChange={(maxAgeDays) => {
            updateDraft({ max_age_days: maxAgeDays ?? 0 });
          }}
        />
      )}
    </SettingsSectionCard>
  );
}

function DangerZoneCard() {
  const deleteAllEmails = useDeleteAllEmails();
  const deleteAllSms = useDeleteAllSms();
  const resetToSeed = useResetToSeed();
  const [pendingAction, setPendingAction] = React.useState<DangerAction | null>(
    null,
  );

  const runDangerAction = (confirmedAction: DangerAction) => {
    const mutationCallbacks = {
      onSuccess: () => {
        toast(dangerActionTexts[confirmedAction].doneMessage);
      },
    };

    if (confirmedAction === "delete-emails") {
      deleteAllEmails.mutate(undefined, mutationCallbacks);
    } else if (confirmedAction === "delete-sms") {
      deleteAllSms.mutate(undefined, mutationCallbacks);
    } else {
      resetToSeed.mutate(undefined, mutationCallbacks);
    }
  };

  return (
    <SettingsSectionCard
      title="Danger zone"
      description="These cannot be undone. Each asks first."
      className="border-destructive/40"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          onClick={() => setPendingAction("delete-emails")}
        >
          <Trash2Icon />
          Delete all emails
        </Button>
        <Button
          variant="destructive"
          onClick={() => setPendingAction("delete-sms")}
        >
          <Trash2Icon />
          Delete all SMS
        </Button>
        <Button variant="destructive" onClick={() => setPendingAction("reset")}>
          <RotateCcwIcon />
          Reset to seed
        </Button>
      </div>
      {pendingAction !== null && (
        <ConfirmActionDialog
          isOpen
          title={dangerActionTexts[pendingAction].title}
          consequence={dangerActionTexts[pendingAction].consequence}
          confirmLabel={dangerActionTexts[pendingAction].confirmLabel}
          onConfirm={() => runDangerAction(pendingAction)}
          onClose={() => setPendingAction(null)}
        />
      )}
    </SettingsSectionCard>
  );
}

/** Retention limits and the destructive actions (PL-05.4). */
export function GeneralSection({ appSettings }: { appSettings: AppSettings }) {
  return (
    <div className="grid gap-4">
      <RetentionCard appSettings={appSettings} />
      <DangerZoneCard />
    </div>
  );
}
