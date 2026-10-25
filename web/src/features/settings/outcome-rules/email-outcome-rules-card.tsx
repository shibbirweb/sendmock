import { PlusIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeResolution } from "@/features/settings/outcome-rules/describe-resolution";
import { EmailOutcomeRuleDialog } from "@/features/settings/outcome-rules/email-outcome-rule-dialog";
import { describeEmailRuleOutcome } from "@/features/settings/outcome-rules/outcome-rule-labels";
import { OutcomeRulesTable } from "@/features/settings/outcome-rules/outcome-rules-table";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useOutcomeRules } from "@/lib/api/hooks/use-outcome-rule-queries";
import type { AppSettings, EmailOutcomeRule } from "@/lib/api/types";
import { resolveEmailOutcome } from "@/lib/outcomes/resolve-outcome";

/** Which rule, magic address or profile an address gets (EM-10.6). */
function EmailOutcomeTester({
  outcomeRules,
  appSettings,
}: {
  outcomeRules: EmailOutcomeRule[];
  appSettings: AppSettings;
}) {
  const testerId = React.useId();
  const [testedAddress, setTestedAddress] = React.useState("bounce@shop.test");
  const resolution = resolveEmailOutcome(
    testedAddress.trim(),
    outcomeRules,
    appSettings.is_magic_addresses_enabled,
  );

  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <Label htmlFor={testerId}>Test an address</Label>
      <Input
        id={testerId}
        className="font-mono"
        value={testedAddress}
        onChange={(changeEvent) => setTestedAddress(changeEvent.target.value)}
      />
      <p
        aria-live="polite"
        data-testid="email-outcome-result"
        className="text-sm"
      >
        {describeResolution(
          resolution,
          (ruleId) => {
            const outcomeRule = outcomeRules.find(
              (existingRule) => existingRule.id === ruleId,
            );

            return outcomeRule === undefined
              ? ""
              : describeEmailRuleOutcome(outcomeRule);
          },
          "Magic address",
          `No rule or magic address matches: the ${appSettings.email_outcome_profile} outcome profile applies.`,
        )}
      </p>
    </div>
  );
}

/** Custom outcome addresses with add, edit, order and a tester (EM-10.5, EM-10.6). */
export function EmailOutcomeRulesCard({
  appSettings,
}: {
  appSettings: AppSettings;
}) {
  const rulesQuery = useOutcomeRules("email");
  const outcomeRules = rulesQuery.data ?? [];
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [editedRule, setEditedRule] = React.useState<EmailOutcomeRule | null>(
    null,
  );

  const openRuleDialog = (outcomeRule: EmailOutcomeRule | null) => {
    setEditedRule(outcomeRule);
    setDialogOpen(true);
  };

  return (
    <SettingsSectionCard
      title="Custom outcome addresses"
      description="Your own test addresses. The first enabled match wins, before the magic addresses and the profile."
    >
      {outcomeRules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom addresses yet.
        </p>
      ) : (
        <OutcomeRulesTable
          ruleKind="email"
          ruleRows={outcomeRules.map((outcomeRule) => ({
            ruleId: outcomeRule.id,
            position: outcomeRule.position,
            matchLabel: null,
            pattern: outcomeRule.pattern,
            outcomeText: describeEmailRuleOutcome(outcomeRule),
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
          Add address
        </Button>
      </div>
      <EmailOutcomeTester
        outcomeRules={outcomeRules}
        appSettings={appSettings}
      />
      <EmailOutcomeRuleDialog
        isOpen={isDialogOpen}
        editedRule={editedRule}
        onOpenChange={setDialogOpen}
      />
    </SettingsSectionCard>
  );
}
