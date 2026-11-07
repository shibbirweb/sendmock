import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { requestApi } from "@/lib/api/api-client";
import type { WhatsappWebhookVerification } from "@/lib/api/types";

/** Meta's callback URL check, sent to the WhatsApp Cloud provider's `webhook_url` (SM-18.4). */
export function WhatsappCallbackCheck() {
  const verification = useMutation({
    mutationFn: () =>
      requestApi<WhatsappWebhookVerification>(
        "/sms/whatsapp-cloud/verify-webhook",
        { method: "POST", requestBody: {} },
      ),
  });
  const result = verification.data;

  return (
    <section aria-label="Callback URL check" className="grid gap-2">
      <h4 className="text-sm font-medium">Callback URL check</h4>
      <p className="text-xs text-muted-foreground">
        Calls the webhook_url credential as Meta does before it sends webhooks
        (hub.mode, hub.verify_token and hub.challenge); your app must answer the
        challenge.
      </p>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={verification.isPending}
          onClick={() => {
            verification.mutate();
          }}
        >
          Verify callback URL
        </Button>
      </div>
      {result !== undefined && (
        <p role="status" className="text-xs">
          {result.is_verified
            ? "Verified: your app answered the challenge."
            : `Not verified: ${result.error ?? `your app answered ${result.status_code ?? "nothing"} with ${result.answer ?? "no body"}`}.`}
        </p>
      )}
      {verification.isError && (
        <p role="status" className="text-xs text-destructive">
          {verification.error.message}
        </p>
      )}
    </section>
  );
}
