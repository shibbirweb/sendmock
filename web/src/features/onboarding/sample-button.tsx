import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WebhookTargets } from "@/features/webhooks/targets/webhook-targets";
import { useCreateSample } from "@/lib/api/hooks/use-sample-queries";
import type { AppEventType, SampleKind, WebhookChoice } from "@/lib/api/types";

const sampleButtonLabels: Record<SampleKind, string> = {
  email: "Send a sample email",
  sms: "Send a sample SMS",
  verification: "Start a sample verification",
  http: "Send a sample request",
};

/** The event each sample fires, whose webhooks the hint names (WH-13.2). */
const sampleEventTypes: Record<SampleKind, AppEventType> = {
  email: "email.received",
  sms: "sms.sent",
  verification: "verify.started",
  http: "http.captured",
};

/** Creates a sample through the API so the screen can be explored (UI-04.2). */
export function SampleButton({
  sampleKind,
  variant = "default",
}: {
  sampleKind: SampleKind;
  variant?: "default" | "outline";
}) {
  const createSample = useCreateSample();
  const sendSample = (webhookChoice: WebhookChoice) => {
    createSample.mutate(
      { sampleKind, webhookChoice },
      {
        onError: () => {
          toast.error(
            `Could not create the sample ${sampleKind === "http" ? "request" : sampleKind}`,
          );
        },
      },
    );
  };

  return (
    <div className="grid justify-items-center gap-1.5">
      <Button
        size="sm"
        variant={variant}
        disabled={createSample.isPending}
        onClick={() => {
          sendSample({});
        }}
      >
        <SendIcon />
        {sampleButtonLabels[sampleKind]}
      </Button>
      <WebhookTargets.Inline
        targetEvent={{ eventType: sampleEventTypes[sampleKind] }}
        actionLabel={sampleButtonLabels[sampleKind]}
        onRun={sendSample}
      />
    </div>
  );
}
