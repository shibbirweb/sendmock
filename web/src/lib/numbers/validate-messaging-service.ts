import type { MessagingServiceInput } from "@/lib/api/types";
import { httpUrlError, isHttpUrl } from "@/lib/numbers/validate-webhook-url";

export type MessagingServiceFieldErrors = Partial<
  Record<keyof MessagingServiceInput, string>
>;

/** A name, and an http(s) request URL when inbound messages go to a webhook. */
export function validateMessagingServiceInput(
  serviceInput: MessagingServiceInput,
): MessagingServiceFieldErrors {
  const fieldErrors: MessagingServiceFieldErrors = {};

  if (serviceInput.friendly_name.trim() === "") {
    fieldErrors.friendly_name = "Enter a name";
  }
  const inboundUrl = serviceInput.inbound_url ?? null;
  const inboundFallbackUrl = serviceInput.inbound_fallback_url ?? null;
  if (serviceInput.inbound_mode === "webhook") {
    if (inboundUrl === null) {
      fieldErrors.inbound_url = "Enter the request URL";
    } else if (!isHttpUrl(inboundUrl)) {
      fieldErrors.inbound_url = httpUrlError;
    }
  }
  if (inboundFallbackUrl !== null && !isHttpUrl(inboundFallbackUrl)) {
    fieldErrors.inbound_fallback_url = httpUrlError;
  }

  return fieldErrors;
}
