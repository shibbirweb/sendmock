import type {
  MessageProviderDefinition,
  WebhookVariable,
} from "@/lib/api/types";

/** The variable Twilio templates sign with; a webhook variable of this name wins. */
export const twilioAuthTokenVariable = "twilio_auth_token";

const twilioSignedTemplateIds = [
  "twilio.status_callback",
  "twilio.inbound_sms",
];

export function isTwilioSignedTemplate(templateId: string): boolean {
  return twilioSignedTemplateIds.includes(templateId);
}

/**
 * Which token signs `twilio.status_callback` and `twilio.inbound_sms`: a global
 * `twilio_auth_token` variable when one is set, else the Twilio provider's
 * token for the event's account (SM-19.6).
 */
export function describeTwilioSigning(
  webhookVariables: WebhookVariable[],
  smsProviders: MessageProviderDefinition[],
): string {
  const hasTokenVariable = webhookVariables.some(
    (webhookVariable) =>
      webhookVariable.name === twilioAuthTokenVariable &&
      webhookVariable.scope === "global",
  );
  if (hasTokenVariable) {
    return `Variable ${twilioAuthTokenVariable}, which wins over the Twilio provider's token.`;
  }
  const mainAccountSid =
    smsProviders
      .find((provider) => provider.key === "twilio")
      ?.credentials.find((credential) => credential.name === "account_sid")
      ?.value ?? "";
  const mainAccountPart =
    mainAccountSid === "" ? "the main account" : `account ${mainAccountSid}`;

  return `Twilio provider: the token of the event's subaccount, or of ${mainAccountPart} for any other. Set a variable named ${twilioAuthTokenVariable} to use your own.`;
}
