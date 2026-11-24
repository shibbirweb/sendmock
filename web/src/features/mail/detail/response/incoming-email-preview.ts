import type { EmailComposerMode } from "@/features/mail/detail/response/email-composer-mode";
import type { EmailResponseFormValues } from "@/features/mail/detail/response/use-email-response-form";
import type { InboundRouteMatchRequest } from "@/lib/api/types";
import { isEmailAddressText } from "@/lib/email/email-address-text";

/**
 * `sam@example.test` out of `Sam <sam@example.test>`, as the server reads it;
 * case is kept, since a route's named groups capture it.
 */
export function readBareAddress(addressText: string): string {
  const bracketMatch = /<([^>]+)>/.exec(addressText);

  return (bracketMatch?.[1] ?? addressText).trim();
}

/** The bare addresses of the entries that are addresses. */
function listBareAddresses(recipientTexts: string[]): string[] {
  return recipientTexts.filter(isEmailAddressText).map(readBareAddress);
}

/**
 * The recipients and headers the incoming email will have once sent, as the
 * reply and forward operations build it (EM-22.3), from the composer's
 * current To and Cc (EM-17.7).
 */
export function buildIncomingEmailPreview(
  composerMode: EmailComposerMode,
  formValues: Pick<
    EmailResponseFormValues,
    | "fromAddress"
    | "forwardToAddress"
    | "toRecipients"
    | "ccRecipients"
    | "subject"
  >,
): InboundRouteMatchRequest {
  const forwardAddress = readBareAddress(formValues.forwardToAddress);
  const headers = {
    subject: formValues.subject,
    from: formValues.fromAddress,
  };
  if (composerMode === "forward") {
    return {
      to: forwardAddress.includes("@") ? [forwardAddress] : [],
      headers,
    };
  }

  return {
    to: listBareAddresses(formValues.toRecipients),
    cc: listBareAddresses(formValues.ccRecipients),
    headers,
  };
}

/** The fields rule filters read from the incoming email before it exists (WH-13.1). */
export function toIncomingRuleFields(
  matchRequest: InboundRouteMatchRequest,
): Record<string, string[]> {
  return {
    to: matchRequest.to,
    cc: matchRequest.cc ?? [],
    subject: [matchRequest.headers?.subject ?? ""],
    from: [readBareAddress(matchRequest.headers?.from ?? "")],
  };
}
