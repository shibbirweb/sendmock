import type { EmailComposerMode } from "@/features/mail/detail/response/email-composer-mode";
import { toIncomingRuleFields } from "@/features/mail/detail/response/incoming-email-preview";
import type { EmailResponseFormValues } from "@/features/mail/detail/response/use-email-response-form";
import { useInboundDestinations } from "@/features/mail/detail/response/use-inbound-destinations";
import { useWebhookTargets } from "@/features/webhooks/targets/use-webhook-targets";
import type { EmailDetail } from "@/lib/api/types";

/**
 * Where a reply or forward goes: the inbound routes and rules (EM-22.3) and
 * the webhooks its `email.inbound` triggers, which can be chosen (WH-13.2).
 */
export function useEmailResponseTargets({
  email,
  composerMode,
  formValues,
}: {
  email: EmailDetail;
  composerMode: EmailComposerMode;
  formValues: EmailResponseFormValues;
}) {
  const inboundDestinations = useInboundDestinations({
    email,
    composerMode,
    formValues,
  });
  const webhookTargets = useWebhookTargets({
    eventType: "email.inbound",
    data: toIncomingRuleFields(inboundDestinations.matchRequest),
  });

  return { inboundDestinations, webhookTargets };
}
