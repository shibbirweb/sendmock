import {
  type EmailComposerMode,
  listOriginalRecipients,
  readReplyRecipient,
} from "@/features/mail/detail/response/email-composer-mode";
import type { EmailResponseFormValues } from "@/features/mail/detail/response/use-email-response-form";
import type { EmailDetail, InboundRouteMatchRequest } from "@/lib/api/types";

/**
 * `sam@example.test` out of `Sam <sam@example.test>`, as the server reads it;
 * case is kept, since a route's named groups capture it.
 */
export function readBareAddress(addressText: string): string {
  const bracketMatch = /<([^>]+)>/.exec(addressText);

  return (bracketMatch?.[1] ?? addressText).trim();
}

/**
 * The recipients and headers the incoming email will have once sent, as the
 * reply and forward operations build it (EM-22.3).
 */
export function buildIncomingEmailPreview(
  email: EmailDetail,
  composerMode: EmailComposerMode,
  formValues: Pick<
    EmailResponseFormValues,
    "fromAddress" | "forwardToAddress" | "subject"
  >,
): InboundRouteMatchRequest {
  const responderAddress = readBareAddress(
    formValues.fromAddress,
  ).toLowerCase();
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
    to: [readReplyRecipient(email).address],
    cc:
      composerMode === "reply_all"
        ? listOriginalRecipients(email)
            .map((recipient) => recipient.address)
            .filter((address) => address.toLowerCase() !== responderAddress)
        : [],
    headers,
  };
}
