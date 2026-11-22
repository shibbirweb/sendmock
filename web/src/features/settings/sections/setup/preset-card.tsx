import { WandSparklesIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/common/copy-button";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { OperationButton } from "@/features/availability/operation-button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { ApiError } from "@/lib/api/api-client";
import { useApplyPreset } from "@/lib/api/hooks/use-preset-queries";

const presetName = "laravel-mailgun-twilio";

/** Sets SendMock up for a stack in one step, as `sendmock preset` does (PL-27.4). */
export function PresetCard() {
  const fieldIdPrefix = React.useId();
  const [appUrl, setAppUrl] = React.useState("http://localhost:8000");
  const applyPreset = useApplyPreset();
  const presetResult = applyPreset.data;

  return (
    <SettingsSectionCard
      title="Presets"
      description="Laravel with Mailgun and Twilio: the Mailgun event and inbound webhooks, Twilio's test sender with your app's URLs, the Debugger URL and a signing key. Running it again changes nothing."
    >
      <FormField
        label="App URL"
        fieldId={`${fieldIdPrefix}-app-url`}
        hint="Where SendMock reaches your app; the webhook paths are the preset's defaults (sendmock preset changes them)."
      >
        <Input
          id={`${fieldIdPrefix}-app-url`}
          type="url"
          value={appUrl}
          onChange={(changeEvent) => setAppUrl(changeEvent.target.value)}
        />
      </FormField>
      <div>
        <OperationButton
          operationKey="POST /api/v1/presets/{presetName}/apply"
          actionName="Apply the preset"
          type="button"
          variant="outline"
          disabled={applyPreset.isPending}
          onClick={() => {
            applyPreset.mutate(
              { presetName, presetInput: { app_url: appUrl.trim() } },
              {
                onError: (applyError) => {
                  toast.error(
                    applyError instanceof ApiError
                      ? applyError.message
                      : "Could not apply the preset",
                  );
                },
              },
            );
          }}
        >
          <WandSparklesIcon />
          Apply the preset
        </OperationButton>
      </div>
      {presetResult !== undefined && (
        <div className="grid gap-2 text-sm">
          {[...presetResult.steps, ...presetResult.warnings].map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Your app&apos;s .env</p>
            <CopyButton
              copyText={presetResult.env_block}
              label="Copy the .env lines"
            />
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
            {presetResult.env_block}
          </pre>
        </div>
      )}
    </SettingsSectionCard>
  );
}
