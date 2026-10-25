import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import * as React from "react";

import { ChipListInput } from "@/components/common/chip-list-input";
import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailMagicAddresses } from "@/features/settings/reference/magic-reference-data";
import { MagicReferenceTable } from "@/features/settings/reference/magic-reference-table";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  SettingsNumberField,
  SettingsSwitchRow,
} from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import type { AppSettings, EmailOutcomeProfile } from "@/lib/api/types";

const receivingKeys = [
  "is_plus_address_tagging_enabled",
  "email_outcome_profile",
  "email_outcome_bounce_rate_percent",
  "email_outcome_complaint_rate_percent",
  "inbound_email_domains",
  "spamassassin_address",
] as const;
const relayKeys = ["relay_smtp_url", "relay_recipient_allowlist"] as const;

const outcomeProfileOptions: {
  value: EmailOutcomeProfile;
  label: string;
  description: string;
}[] = [
  {
    value: "off",
    label: "Off",
    description:
      "No delivery events unless you simulate one or use a magic address.",
  },
  {
    value: "auto-delivered",
    label: "Auto-delivered",
    description: "Every email gets email.delivered after a short delay.",
  },
  {
    value: "realistic",
    label: "Realistic",
    description: "A delay, plus the bounce and complaint rates below.",
  },
];

function toNullableText(fieldText: string): string | null {
  return fieldText.trim() === "" ? null : fieldText.trim();
}

function ReceivingCard({ appSettings }: { appSettings: AppSettings }) {
  const fieldIdPrefix = React.useId();
  const sectionForm = useSettingsSectionForm(appSettings, receivingKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <SettingsSectionCard
      title="Receiving and delivery outcomes"
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <SettingsSwitchRow
        label="Tag by plus address"
        description="user+invoice@app.test gets the tag invoice."
        isChecked={draftValues.is_plus_address_tagging_enabled}
        onCheckedChange={(isEnabled) => {
          updateDraft({ is_plus_address_tagging_enabled: isEnabled });
        }}
      />
      <RadioCardGroup
        legend="Delivery outcome profile"
        options={outcomeProfileOptions}
        selectedValue={draftValues.email_outcome_profile}
        onSelect={(outcomeProfile) => {
          updateDraft({ email_outcome_profile: outcomeProfile });
        }}
      />
      {draftValues.email_outcome_profile === "realistic" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsNumberField
            label="Bounce rate"
            unitLabel="%"
            value={draftValues.email_outcome_bounce_rate_percent}
            errorMessage={fieldErrors.email_outcome_bounce_rate_percent}
            onValueChange={(bounceRate) => {
              updateDraft({
                email_outcome_bounce_rate_percent: bounceRate ?? 0,
              });
            }}
          />
          <SettingsNumberField
            label="Complaint rate"
            unitLabel="%"
            value={draftValues.email_outcome_complaint_rate_percent}
            errorMessage={fieldErrors.email_outcome_complaint_rate_percent}
            onValueChange={(complaintRate) => {
              updateDraft({
                email_outcome_complaint_rate_percent: complaintRate ?? 0,
              });
            }}
          />
        </div>
      )}
      <FormField
        label="Inbound domains"
        fieldId={`${fieldIdPrefix}-domains`}
        hint="Mail for these domains is incoming (replies, support inboxes) and fires email.inbound."
      >
        <ChipListInput
          inputId={`${fieldIdPrefix}-domains`}
          values={draftValues.inbound_email_domains}
          placeholder="reply.app.test"
          onChange={(inboundDomains) => {
            updateDraft({ inbound_email_domains: inboundDomains });
          }}
        />
      </FormField>
      <FormField
        label="SpamAssassin address"
        fieldId={`${fieldIdPrefix}-spamd`}
        hint="host:port of a running spamd. Leave empty to turn the spam check off."
        errorMessage={fieldErrors.spamassassin_address}
      >
        <Input
          id={`${fieldIdPrefix}-spamd`}
          placeholder="127.0.0.1:783"
          value={draftValues.spamassassin_address ?? ""}
          aria-invalid={fieldErrors.spamassassin_address !== undefined}
          onChange={(changeEvent) => {
            updateDraft({
              spamassassin_address: toNullableText(changeEvent.target.value),
            });
          }}
        />
      </FormField>
    </SettingsSectionCard>
  );
}

function RelayCard({ appSettings }: { appSettings: AppSettings }) {
  const fieldIdPrefix = React.useId();
  const sectionForm = useSettingsSectionForm(appSettings, relayKeys);
  const { draftValues, updateDraft, fieldErrors } = sectionForm;

  return (
    <SettingsSectionCard
      title="Release to real SMTP"
      description="Release and auto-forward send through this relay, and only to allowed recipients."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <FormField
        label="Relay SMTP URL"
        fieldId={`${fieldIdPrefix}-relay`}
        hint="The password is stored and shown masked."
        errorMessage={fieldErrors.relay_smtp_url}
      >
        <Input
          id={`${fieldIdPrefix}-relay`}
          placeholder="smtp://user:password@smtp.example.com:587"
          value={draftValues.relay_smtp_url ?? ""}
          aria-invalid={fieldErrors.relay_smtp_url !== undefined}
          onChange={(changeEvent) => {
            updateDraft({
              relay_smtp_url: toNullableText(changeEvent.target.value),
            });
          }}
        />
      </FormField>
      <FormField
        label="Allowed recipients"
        fieldId={`${fieldIdPrefix}-allowlist`}
        hint={
          draftValues.relay_recipient_allowlist.length === 0
            ? "Release stays off until at least one pattern is added."
            : "Glob patterns, for example *@qa.company.com."
        }
        errorMessage={fieldErrors.relay_recipient_allowlist}
      >
        <ChipListInput
          inputId={`${fieldIdPrefix}-allowlist`}
          values={draftValues.relay_recipient_allowlist}
          placeholder="*@qa.company.com"
          isInvalid={fieldErrors.relay_recipient_allowlist !== undefined}
          onChange={(allowedPatterns) => {
            updateDraft({ relay_recipient_allowlist: allowedPatterns });
          }}
        />
      </FormField>
    </SettingsSectionCard>
  );
}

/** Email options, relay and the magic addresses reference. */
export function EmailSection({ appSettings }: { appSettings: AppSettings }) {
  return (
    <div className="grid gap-4">
      <ReceivingCard appSettings={appSettings} />
      <RelayCard appSettings={appSettings} />
      <SettingsSectionCard
        title="Tag and forward rules"
        description="Rules that tag or auto-forward arriving emails use the same visual rule builder as webhook rules."
      >
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/webhooks/rules">
              <ExternalLinkIcon />
              Open the rule builder
            </Link>
          </Button>
        </div>
      </SettingsSectionCard>
      <SettingsSectionCard
        title="Magic addresses"
        description="Send to these to get a delivery outcome without touching any setting."
      >
        <MagicReferenceTable
          caption="Recipients"
          triggerHeading="Recipient"
          referenceRows={emailMagicAddresses}
        />
      </SettingsSectionCard>
    </div>
  );
}
