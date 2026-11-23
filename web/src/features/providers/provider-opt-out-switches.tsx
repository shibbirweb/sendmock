import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";

/** SMS providers: Twilio's Advanced Opt-Out and its auto-replies (SM-23.2, SM-23.3). */
export function ProviderOptOutSwitches({
  providerForm,
  fieldIdPrefix,
}: {
  providerForm: MessageProviderForm;
  fieldIdPrefix: string;
}) {
  const { providerInput, updateInput } = providerForm;
  const hasOptOutKeywords = providerInput.opt_out_keywords ?? false;

  return (
    <>
      <div className="flex items-start gap-2">
        <Switch
          id={`${fieldIdPrefix}-opt-out-keywords`}
          checked={hasOptOutKeywords}
          onCheckedChange={(isChecked) =>
            updateInput({ opt_out_keywords: isChecked })
          }
        />
        <div className="grid gap-0.5">
          <Label htmlFor={`${fieldIdPrefix}-opt-out-keywords`}>
            Opt-out keywords
          </Label>
          <p className="text-xs text-muted-foreground">
            A text of STOP blocks later sends to that contact with error 21610
            until they text START, as Twilio's Advanced Opt-Out does.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Switch
          id={`${fieldIdPrefix}-opt-out-replies`}
          checked={providerInput.opt_out_auto_replies}
          disabled={!hasOptOutKeywords}
          onCheckedChange={(isChecked) =>
            updateInput({ opt_out_auto_replies: isChecked })
          }
        />
        <div className="grid gap-0.5">
          <Label htmlFor={`${fieldIdPrefix}-opt-out-replies`}>
            Opt-out auto-replies
          </Label>
          <p className="text-xs text-muted-foreground">
            Answers STOP, START and HELP with Twilio's default replies.
          </p>
        </div>
      </div>
    </>
  );
}
