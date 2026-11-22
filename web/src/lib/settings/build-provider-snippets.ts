import type { SnippetLanguage } from "@/lib/settings/build-connection-snippets";

/** Where the provider APIs are reached from the app. */
export type ProviderSnippetTarget = {
  host: string;
  providerPort: number;
  providerTlsPort: number;
};

const mailgunSigningLine =
  "# Webhook signing key: the mailgun_signing_key webhook variable (sendmock webhooks variables list).";
const twilioSigningLine =
  "# Webhooks are signed with the auth token; a subaccount's number signs with the subaccount's token.";
const twilioRecipeLine =
  "(see Connect your app, SDKs without a base URL setting)";

/**
 * Mailgun's settings for a stack, word for word as the server's
 * `provider_snippet.rs` writes them for `GET /integrations/{stack}` (AI-08.2).
 */
export function buildMailgunSnippet(
  language: SnippetLanguage,
  { host, providerPort, providerTlsPort }: ProviderSnippetTarget,
): string {
  const apiBase = `http://${host}:${providerPort}`;
  switch (language) {
    case "laravel":
      return `MAIL_MAILER=mailgun\nMAILGUN_DOMAIN=mg.example.test\nMAILGUN_SECRET=key-sendmock\nMAILGUN_ENDPOINT=${host}:${providerTlsPort}\nMAILGUN_SCHEME=https\n# Laravel's mailgun mailer only speaks HTTPS: start SendMock with --provider-tls-addr and run \`sendmock trust\` once.\n${mailgunSigningLine}`;
    case "node":
      return `new Mailgun(FormData).client({ username: "api", key: "key-sendmock", url: "${apiBase}" });\n${mailgunSigningLine}`;
    case "curl":
      return `curl -s --user "api:key-sendmock" ${apiBase}/v3/mg.example.test/messages \\\n  -F from=app@mg.example.test -F to=user@example.com -F subject=Hello -F text=Hi`;
    default:
      return `# Send to Mailgun's API at ${apiBase} instead of https://api.mailgun.net (the SDK's base URL or endpoint setting).\n${mailgunSigningLine}`;
  }
}

/** Twilio's settings for a stack, as `provider_snippet.rs` writes them (AI-08.2). */
export function buildTwilioSnippet(
  language: SnippetLanguage,
  { host, providerPort }: ProviderSnippetTarget,
): string {
  const apiBase = `http://${host}:${providerPort}`;
  if (language === "curl") {
    return `curl -s -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" ${apiBase}/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \\\n  -d To=+15550002222 -d From=+15005550006 -d Body=Hello`;
  }
  const clientLines: Partial<Record<SnippetLanguage, string>> = {
    laravel: `# The Twilio PHP SDK has no base URL setting: give the Client a CurlClient that sends to ${apiBase} ${twilioRecipeLine}.`,
    node: `# Give twilio() an httpClient, a RequestClient that sends to ${apiBase} ${twilioRecipeLine}.`,
    python: `# Give Client an http_client, a TwilioHttpClient that sends to ${apiBase} ${twilioRecipeLine}.`,
  };
  const clientLine =
    clientLines[language] ??
    `# Send to Twilio's API at ${apiBase} instead of https://api.twilio.com (the SDK's HTTP client setting).`;

  return `TWILIO_ACCOUNT_SID=<Account SID in SMS > Providers > Twilio>\nTWILIO_AUTH_TOKEN=<Auth Token in SMS > Providers > Twilio>\n${clientLine}\n${twilioSigningLine}`;
}
