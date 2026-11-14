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
  if (serviceInput.inbound_mode === "webhook") {
    if (serviceInput.inbound_url === null) {
      fieldErrors.inbound_url = "Enter the request URL";
    } else if (!isHttpUrl(serviceInput.inbound_url)) {
      fieldErrors.inbound_url = httpUrlError;
    }
  }
  if (
    serviceInput.inbound_fallback_url !== null &&
    !isHttpUrl(serviceInput.inbound_fallback_url)
  ) {
    fieldErrors.inbound_fallback_url = httpUrlError;
  }

  return fieldErrors;
}
