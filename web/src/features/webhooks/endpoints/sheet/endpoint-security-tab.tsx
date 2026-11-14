import { EyeIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useRevealEndpointSecret,
  useRotateEndpointSecret,
} from "@/lib/api/hooks/use-webhook-endpoint-queries";
import type { WebhookEndpoint } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";
import { describeSigningScheme } from "@/lib/webhooks/describe-signing-scheme";

const overlapOptions = [
  { overlapHours: 1, label: "1 hour" },
  { overlapHours: 24, label: "24 hours" },
  { overlapHours: 168, label: "7 days" },
];

type PendingSecretAction = "reveal" | "rotate" | null;

/** The masked secret, reveal behind a confirmation, and rotation (WH-01.3, WH-01.8). */
export function EndpointSecurityTab({
  webhookEndpoint,
  templateId,
}: {
  webhookEndpoint: WebhookEndpoint;
  templateId: string;
}) {
  const fieldIdPrefix = React.useId();
  const revealEndpointSecret = useRevealEndpointSecret();
  const rotateEndpointSecret = useRotateEndpointSecret();
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(
    null,
  );
  const [overlapHours, setOverlapHours] = React.useState("24");
  const [pendingAction, setPendingAction] =
    React.useState<PendingSecretAction>(null);

  const revealSecret = () => {
    revealEndpointSecret.mutate(webhookEndpoint.id, {
      onSuccess: ({ secret }) => {
        setRevealedSecret(secret);
      },
      onError: () => {
        toast.error("Could not reveal the secret");
      },
    });
  };

  const rotateSecret = () => {
    rotateEndpointSecret.mutate(
      { endpointId: webhookEndpoint.id, overlapHours: Number(overlapHours) },
      {
        onSuccess: () => {
          setRevealedSecret(null);
          toast("Secret rotated");
        },
        onError: () => {
          toast.error("Could not rotate the secret");
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Signing secret</span>
        <div className="flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2">
          <code
            data-testid="endpoint-secret"
            className="min-w-0 flex-1 truncate font-mono text-xs"
          >
            {revealedSecret ?? webhookEndpoint.masked_secret}
          </code>
          {revealedSecret === null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={revealEndpointSecret.isPending}
              onClick={() => {
                setPendingAction("reveal");
              }}
            >
              <EyeIcon />
              Reveal
            </Button>
          ) : (
            <CopyButton copyText={revealedSecret} label="Copy secret" />
          )}
        </div>
        {webhookEndpoint.previous_secret_expires_at !== null && (
          <p
            data-testid="previous-secret-expiry"
            className="text-xs text-muted-foreground"
          >
            The previous secret also signs until{" "}
            {formatDateTime(webhookEndpoint.previous_secret_expires_at)}.
          </p>
        )}
      </div>
      <div className="grid gap-3 rounded-md border p-3">
        <FormField
          label="Overlap after rotating"
          fieldId={`${fieldIdPrefix}-overlap`}
          hint="Both secrets sign during the overlap, so you can test a rolling update."
        >
          <Select value={overlapHours} onValueChange={setOverlapHours}>
            <SelectTrigger id={`${fieldIdPrefix}-overlap`} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {overlapOptions.map((overlapOption) => (
                <SelectItem
                  key={overlapOption.overlapHours}
                  value={String(overlapOption.overlapHours)}
                >
                  {overlapOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={rotateEndpointSecret.isPending}
          onClick={() => {
            setPendingAction("rotate");
          }}
        >
          <RefreshCwIcon />
          Rotate secret
        </Button>
      </div>
      <div className="grid gap-0.5 text-xs">
        <span className="font-medium">Signature</span>
        <span className="text-muted-foreground">
          {describeSigningScheme(templateId)}
        </span>
      </div>
      <ConfirmActionDialog
        isOpen={pendingAction === "reveal"}
        title="Reveal the signing secret?"
        consequence="The plain secret shows on screen and the reveal is written to the API request log."
        confirmLabel="Reveal"
        onConfirm={revealSecret}
        onClose={() => {
          setPendingAction(null);
        }}
      />
      <ConfirmActionDialog
        isOpen={pendingAction === "rotate"}
        title="Rotate the signing secret?"
        consequence="A new secret starts signing now. The current one keeps signing until the overlap ends, then receivers must use the new one."
        confirmLabel="Rotate"
        onConfirm={rotateSecret}
        onClose={() => {
          setPendingAction(null);
        }}
      />
    </div>
  );
}
