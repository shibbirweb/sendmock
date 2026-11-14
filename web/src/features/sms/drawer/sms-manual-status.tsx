import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  describeSmsErrorCode,
  manualSmsErrorCodes,
  smsStatusLabels,
} from "@/features/sms/sms-labels";
import { useWebhookTargets } from "@/features/webhooks/targets/use-webhook-targets";
import { WebhookTargets } from "@/features/webhooks/targets/webhook-targets";
import { useSetSmsStatus } from "@/lib/api/hooks/use-sms-queries";
import type { SmsMessage, SmsStatus } from "@/lib/api/types";

const manualStatuses: SmsStatus[] = ["delivered", "undelivered", "failed"];
const defaultErrorCode = "30003";

/**
 * Sets the delivery outcome by hand, as the `manual` simulation profile
 * expects. Undelivered and Failed carry the picked error code.
 */
export function SmsManualStatus({ smsMessage }: { smsMessage: SmsMessage }) {
  const setSmsStatus = useSetSmsStatus();
  const [errorCode, setErrorCode] = React.useState(defaultErrorCode);
  // Rules can filter on the status, so the row previews the button in reach.
  const [previewedStatus, setPreviewedStatus] =
    React.useState<SmsStatus>("delivered");
  const webhookTargets = useWebhookTargets({
    eventType: "sms.status",
    subjectId: smsMessage.id,
    data: { status: [previewedStatus] },
  });
  const errorCodeFieldId = React.useId();

  const applyManualStatus = (smsStatus: SmsStatus) => {
    const appliedErrorCode = smsStatus === "delivered" ? null : errorCode;
    setSmsStatus.mutate(
      {
        smsId: smsMessage.id,
        smsStatus,
        errorCode: appliedErrorCode,
        webhookChoice: webhookTargets.webhookChoice,
      },
      {
        onSuccess: () => {
          toast(`Status set to ${smsStatusLabels[smsStatus]}`);
        },
        onError: () => {
          toast.error("Could not set the status");
        },
      },
    );
  };

  return (
    <section
      aria-labelledby={`${errorCodeFieldId}-title`}
      className="grid gap-2"
    >
      <h3 id={`${errorCodeFieldId}-title`} className="text-sm font-medium">
        Set status
      </h3>
      <div className="grid gap-1.5">
        <Label
          htmlFor={errorCodeFieldId}
          className="text-xs text-muted-foreground"
        >
          Error code for Undelivered and Failed
        </Label>
        <Select value={errorCode} onValueChange={setErrorCode}>
          <SelectTrigger id={errorCodeFieldId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {manualSmsErrorCodes.map((manualErrorCode) => (
              <SelectItem key={manualErrorCode} value={manualErrorCode}>
                {describeSmsErrorCode(manualErrorCode)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {manualStatuses.map((manualStatus) => (
          <Button
            key={manualStatus}
            variant={manualStatus === "delivered" ? "default" : "outline"}
            size="sm"
            disabled={setSmsStatus.isPending}
            onPointerEnter={() => {
              setPreviewedStatus(manualStatus);
            }}
            onFocus={() => {
              setPreviewedStatus(manualStatus);
            }}
            onClick={() => {
              applyManualStatus(manualStatus);
            }}
          >
            {smsStatusLabels[manualStatus]}
          </Button>
        ))}
      </div>
      <WebhookTargets.Row
        webhookTargets={webhookTargets}
        actionLabel={`setting ${smsStatusLabels[previewedStatus]}`}
        heading={`Webhooks for ${smsStatusLabels[previewedStatus]}:`}
      />
    </section>
  );
}
