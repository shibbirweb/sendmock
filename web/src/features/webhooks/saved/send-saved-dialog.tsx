import { SendIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SentDeliveryResult } from "@/features/webhooks/deliveries/sent-delivery-result";
import { useSendSavedDelivery } from "@/lib/api/hooks/use-saved-delivery-queries";
import type {
  SavedDelivery,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/api/types";

/** Sends a saved request to any endpoint, optionally re-rendered (WH-10.2). Mount when opening. */
export function SendSavedDialog({
  savedDelivery,
  webhookEndpoints,
  onClose,
}: {
  savedDelivery: SavedDelivery;
  webhookEndpoints: WebhookEndpoint[];
  onClose: () => void;
}) {
  const fieldIdPrefix = React.useId();
  const sendSavedDelivery = useSendSavedDelivery();
  const [endpointId, setEndpointId] = React.useState(
    savedDelivery.endpoint_id ?? webhookEndpoints[0]?.id ?? "",
  );
  const [shouldRerender, setShouldRerender] = React.useState(true);
  const [sentDelivery, setSentDelivery] =
    React.useState<WebhookDelivery | null>(null);

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send "{savedDelivery.name}"</DialogTitle>
          <DialogDescription>
            The stored body goes to the endpoint's URL with its method.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField label="Endpoint" fieldId={`${fieldIdPrefix}-endpoint`}>
            <Select value={endpointId} onValueChange={setEndpointId}>
              <SelectTrigger
                id={`${fieldIdPrefix}-endpoint`}
                className="w-full"
              >
                <SelectValue placeholder="Pick an endpoint" />
              </SelectTrigger>
              <SelectContent>
                {webhookEndpoints.map((webhookEndpoint) => (
                  <SelectItem
                    key={webhookEndpoint.id}
                    value={webhookEndpoint.id}
                  >
                    {webhookEndpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`${fieldIdPrefix}-rerender`}
              checked={shouldRerender}
              onCheckedChange={(checkedState) => {
                setShouldRerender(checkedState === true);
              }}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`${fieldIdPrefix}-rerender`}>
                Re-render with fresh values
              </Label>
              <p className="text-xs text-muted-foreground">
                New timestamp, signature and random values, as a fresh event
                would get.
              </p>
            </div>
          </div>
          {sentDelivery !== null && (
            <SentDeliveryResult sentDelivery={sentDelivery} />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {sentDelivery === null ? "Cancel" : "Done"}
          </Button>
          <Button
            type="button"
            disabled={endpointId === "" || sendSavedDelivery.isPending}
            onClick={() => {
              sendSavedDelivery.mutate(
                {
                  savedId: savedDelivery.id,
                  sendRequest: {
                    endpoint_id: endpointId,
                    rerender: shouldRerender,
                  },
                },
                {
                  onSuccess: setSentDelivery,
                  onError: () => {
                    toast.error("Could not send the saved delivery");
                  },
                },
              );
            }}
          >
            <SendIcon />
            {sentDelivery === null ? "Send" : "Send again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
