import { describeTwilioSigning } from "@/features/webhooks/twilio-signing/describe-twilio-signing";
import { useMessageProviders } from "@/lib/api/hooks/use-message-provider-queries";
import { useWebhookVariables } from "@/lib/api/hooks/use-webhook-queries";

/** Which token signs the Twilio templates right now (SM-19.6). */
export function TwilioSigningSource({ className }: { className?: string }) {
  const variablesQuery = useWebhookVariables();
  const providersQuery = useMessageProviders("sms");

  return (
    <span className={className} data-testid="twilio-signing-source">
      {describeTwilioSigning(
        variablesQuery.data ?? [],
        providersQuery.data ?? [],
      )}
    </span>
  );
}
