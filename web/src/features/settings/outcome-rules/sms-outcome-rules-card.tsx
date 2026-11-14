import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeSmsRuleOutcome } from "@/lib/outcomes/outcome-rule-labels";
import { OutcomeRulesTable } from "@/features/settings/outcome-rules/outcome-rules-table";
import { SmsOutcomeRuleDialog } from "@/features/settings/outcome-rules/sms-outcome-rule-dialog";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useOutcomeTest } from "@/lib/api/hooks/use-automation-queries";
import { useOutcomeRules } from "@/lib/api/hooks/use-outcome-rule-queries";
import type { AppSettings, SmsOutcomeRule } from "@/lib/api/types";

/** Which rule, magic number or profile a number gets (SM-07.9). */
function SmsOutcomeTester({ appSettings }: { appSettings: AppSettings }) {
  const testerId = React.useId();
  const [testedNumber, setTestedNumber] = React.useState("+15005550001");
  const [matchField, setMatchField] = React.useState<"to" | "from">("to");
  const outcomeTest = useOutcomeTest({
    ruleKind: "sms",
    testedValue: testedNumber.trim(),
    matchField,
    settingsKey: `${appSettings.is_magic_numbers_enabled}/${appSettings.sms_simulation_profile}`,
  });

  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <Label htmlFor={testerId}>Test a number</Label>
      <div className="flex gap-2">
        <Select
          value={matchField}
          onValueChange={(nextField) =>
            setMatchField(nextField as "to" | "from")
          }
        >
          <SelectTrigger aria-label="Number is the" className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="to">As To</SelectItem>
            <SelectItem value="from">As From</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id={testerId}
          className="font-mono"
          value={testedNumber}
          onChange={(changeEvent) => setTestedNumber(changeEvent.target.value)}
        />
      </div>
      <p
        aria-live="polite"
        data-testid="sms-outcome-result"
        className="text-sm"
      >
        {outcomeTest.data?.summary ?? ""}
      </p>
    </div>
  );
}

/** Custom outcome numbers with add, edit, order and a tester (SM-07.7 to SM-07.9). */
export function SmsOutcomeRulesCard({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const rulesQuery = useOutcomeRules("sms");
  const outcomeRules = rulesQuery.data ?? [];
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [editedRule, setEditedRule] = React.useState<SmsOutcomeRule | null>(
    null,
  );

  const openRuleDialog = (outcomeRule: SmsOutcomeRule | null) => {
    setEditedRule(outcomeRule);
    setDialogOpen(true);
  };

  return (
    <SettingsSectionCard
      title="Custom outcome numbers"
      description="Your own test numbers. The first enabled match wins, before the magic numbers and the profile."
    >
      {outcomeRules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom numbers yet.</p>
      ) : (
        <OutcomeRulesTable
          ruleKind="sms"
          ruleRows={outcomeRules.map((outcomeRule) => ({
            ruleId: outcomeRule.id,
            position: outcomeRule.position,
            matchLabel: outcomeRule.match_field === "to" ? "To" : "From",
            pattern: outcomeRule.pattern,
            outcomeText: describeSmsRuleOutcome(outcomeRule),
            note: outcomeRule.note,
            isEnabled: outcomeRule.is_enabled,
          }))}
          onEdit={(ruleId) =>
            openRuleDialog(
              outcomeRules.find((outcomeRule) => outcomeRule.id === ruleId) ??
                null,
            )
          }
        />
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openRuleDialog(null)}
        >
          <PlusIcon />
          Add number
        </Button>
      </div>
      <SmsOutcomeTester appSettings={appSettings} />
      <SmsOutcomeRuleDialog
        isOpen={isDialogOpen}
        editedRule={editedRule}
        onOpenChange={setDialogOpen}
      />
    </SettingsSectionCard>
  );
}
