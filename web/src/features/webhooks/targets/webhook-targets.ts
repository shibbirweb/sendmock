import { WebhookTargetsInline } from "@/features/webhooks/targets/webhook-targets-inline";
import {
  WebhookTargetsMenuItem,
  WebhookTargetsMenuScope,
} from "@/features/webhooks/targets/webhook-targets-menu";
import { WebhookTargetsPicker } from "@/features/webhooks/targets/webhook-targets-picker";
import { WebhookTargetsRow } from "@/features/webhooks/targets/webhook-targets-row";

/**
 * Names the webhooks every simulating action will trigger and lets one action
 * send to others (WH-13). A new simulating action uses one of these parts:
 * `Row` in a composer, `MenuItem` inside a `MenuScope` in a menu, `Inline`
 * under a one-click button.
 */
export const WebhookTargets = {
  Row: WebhookTargetsRow,
  MenuScope: WebhookTargetsMenuScope,
  MenuItem: WebhookTargetsMenuItem,
  Inline: WebhookTargetsInline,
  Picker: WebhookTargetsPicker,
};
