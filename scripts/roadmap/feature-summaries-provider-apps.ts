// Plug and play for Mailgun and Twilio apps (A28, 1.5.0): what each feature is and what it lets
// a developer do.
import type { FeatureSummary } from "./feature-summaries";

export const providerAppFeatureSummaries: Record<string, FeatureSummary> = {
  "EM-24": {
    summary:
      "Mailgun template sends are accepted, X-Mailgun-Variables and v: fields become the email's user variables, provider message ids are kept, and provider routes decode percent-encoded paths.",
    outcome:
      "Send through Mailgun's API or SDKs exactly as in production and match every webhook to the send.",
  },
  "EM-25": {
    summary:
      "The built-in Mailgun webhooks carry user-variables, delivery-status, soft and hard bounces and the full inbound route payload, and each template lists only the events its provider sends.",
    outcome:
      "Point an app's Mailgun webhook handlers at SendMock without writing custom templates.",
  },
  "EM-26": {
    summary:
      "Mailgun's stored messages in full, linked from webhooks and events, and local email templates managed on every surface and served through Mailgun's template API.",
    outcome:
      "Test template sends, inbound mail and stored-message lookups the way the app uses Mailgun.",
  },
  "EM-27": {
    summary:
      "Simulated opens, clicks, bounces and complaints take the app's user variables, and viewing an email no longer fires the app's open webhook by surprise.",
    outcome:
      "Test open and bounce tracking for any email, SMTP-sent ones included, without editing payloads.",
  },
  "SM-22": {
    summary:
      "Twilio subaccounts everywhere: inbound messages carry and are signed by the owning account, location fields are sent, fetches are scoped to the URL's account, 401s say why, and numbers keep their account.",
    outcome:
      "Run a multi-tenant Twilio app against SendMock and see what production would do.",
  },
  "SM-23": {
    summary:
      "Twilio's Advanced Opt-Out: STOP and the other keywords block later sends with 21610 until START, with optional auto-replies, switchable and listed on every surface.",
    outcome:
      "Test how the app handles opted-out numbers without an outcome rule.",
  },
  "SM-24": {
    summary:
      "A final SMS status set by hand ends the simulated lifecycle, and its status callback goes out in order, with the CLI and UI saying when.",
    outcome:
      "Set a message's fate by hand and trust the app sees exactly that.",
  },
  "PL-24": {
    summary:
      "The provider API port starts by default on 127.0.0.1:8026, steps aside when the port is busy, and status and MCP warn when it is off.",
    outcome:
      "Point an SDK at SendMock without restarting it with another flag.",
  },
  "PL-25": {
    summary:
      "sendmock trust makes the system and the language runtimes that ignore it (PHP, Python, Java, Node) trust SendMock's local CA, with --check and --undo.",
    outcome:
      "Use SDKs and mailers that only speak HTTPS, such as Laravel's Mailgun mailer, in one step.",
  },
  "PL-26": {
    summary:
      "setup validate matches setup import, merge imports stop talking about deletes, reset says what it kept and can reset configuration, and updates accept partial bodies.",
    outcome:
      "Change and reset SendMock's configuration without surprises.",
  },
  "PL-27": {
    summary:
      "sendmock preset sets SendMock up for a stack in one step, starting with laravel-mailgun-twilio: ports, trust, Mailgun, Twilio, webhooks and the .env block.",
    outcome:
      "Go from install to a working Laravel, Mailgun and Twilio setup with one command.",
  },
  "AI-08": {
    summary:
      "A template reference generated from real event data, Mailgun and Twilio integration snippets, recipes for SDKs without a base URL, and MCP toolsets that cover routine setup.",
    outcome:
      "Let an agent or a developer set up a provider app from the docs and tools alone.",
  },
};
