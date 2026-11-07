import type { FeatureSummary } from "./feature-summaries";

/** Email, SMS, Verify, webhooks, the HTTP catcher and the platform. */
export const messagingFeatureSummaries: Record<string, FeatureSummary> = {
  "EM-01": {
    summary:
      "A catch-all SMTP server on `127.0.0.1:1025` that accepts mail for any address and stores it instead of delivering it.",
    outcome:
      "Point any app's SMTP settings at SendMock and every email it sends is captured locally, with nothing reaching a real inbox.",
  },
  "EM-02": {
    summary:
      "STARTTLS, implicit TLS and SMTP AUTH (PLAIN, LOGIN, CRAM-MD5) on the SMTP listener, with accept-any, file-based or disabled authentication.",
    outcome:
      "Apps that insist on TLS or credentials can send to SendMock with their production mail settings unchanged.",
  },
  "EM-03": {
    summary:
      "Compressed storage of every raw message with retention limits by count and age, and full-text search across stored mail.",
    outcome:
      "Inspect the exact bytes an app sent, keep the store small during long runs, and find any message quickly.",
  },
  "EM-04": {
    summary:
      "A safe email viewer: sandboxed HTML, blocked remote images until asked, plain text, headers, the MIME tree, raw source and device previews.",
    outcome:
      "See an email exactly as recipients would, debug its structure, and never run untrusted content from it.",
  },
  "EM-05": {
    summary:
      "Automatic extraction of one-time codes and links (verification, reset, unsubscribe) from every email, with custom patterns.",
    outcome:
      "Tests and developers read a sign-up code or reset link in one call instead of parsing email bodies.",
  },
  "EM-06": {
    summary:
      "A `sendmock sendmail` shim that reads a message on stdin and stores it like an SMTP message.",
    outcome:
      "Apps that send through `sendmail` (PHP `mail()`, cron, legacy scripts) are captured without code changes.",
  },
  "EM-07": {
    summary:
      "`POST /api/v1/send`, a native HTTP API to send an email with recipients, bodies, headers and attachments.",
    outcome:
      "Tests and tools can create realistic emails without speaking SMTP.",
  },
  "EM-08": {
    summary:
      "Emulation of the send APIs of SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo, with their real request, response and error shapes.",
    outcome:
      "Apps that use a provider's SDK or HTTP API point at SendMock by changing the base URL, and their emails are captured.",
  },
  "EM-09": {
    summary:
      "A log of every SMTP session: the commands, replies, TLS and AUTH state, and the message it produced.",
    outcome:
      "Diagnose why a client's mail was rejected or malformed by reading the conversation it had with the server.",
  },
  "EM-10": {
    summary:
      "Simulated delivery outcomes (delivered, deferred, bounced, complained, rejected) through magic addresses, delivery profiles and manual actions.",
    outcome:
      "Test how an app handles bounces, complaints and failures without sending to real addresses.",
  },
  "EM-11": {
    summary:
      "`email.opened` events when an email is opened in the UI or through the API, with open counts and first-open detection.",
    outcome: "Exercise open-tracking code paths and webhooks locally.",
  },
  "EM-12": {
    summary:
      "Tags on emails, from plus-addressing, headers and rules, and editable in the UI and API.",
    outcome: "Group and filter mail by flow, test or tenant.",
  },
  "EM-13": {
    summary:
      "Quality checks on each email: HTML and CSS support across clients, links, List-Unsubscribe and a spam score.",
    outcome:
      "Catch rendering, deliverability and compliance problems before an email reaches production.",
  },
  "EM-14": {
    summary:
      "Release a caught email, or auto-forward matching mail, to a real SMTP relay, only to an allowlist of recipients.",
    outcome:
      "Check a message in a real mail client when needed, without risking mail to customers.",
  },
  "EM-15": {
    summary:
      "SMTP chaos: reject the next N messages, refuse recipient patterns, add latency and drop connections on purpose.",
    outcome: "Prove an app retries and reports SMTP failures correctly.",
  },
  "EM-16": {
    summary:
      "Browser notifications for new email, respecting the current filter.",
    outcome: "Notice new mail while working in another window.",
  },
  "EM-17": {
    summary:
      "Simulated replies to an email and inbound email through an API, raw MIME or an inbound SMTP domain.",
    outcome:
      "Test reply-by-email, support-ticket and inbound-parsing features end to end.",
  },
  "EM-18": {
    summary:
      "Email providers defined as configuration (built-in or custom), with their routes, auth, request mapping and responses.",
    outcome:
      "Add a provider SendMock does not ship, or adjust a built-in one, without waiting for a release.",
  },
  "EM-19": {
    summary:
      "Mailpit's REST API paths and answers on SendMock: list, search, read, tag and delete messages as Mailpit's API does.",
    outcome:
      "Switch a test suite written against Mailpit's API to SendMock with no code change.",
  },
  "EM-20": {
    summary:
      "An `email.clicked` event when a link in a caught email is clicked: from the preview, Simulate click or the API, sent in each provider's own click shape.",
    outcome:
      "Test click tracking and engagement logic the way you test opens, with no real recipient.",
  },
  "EM-21": {
    summary:
      "A POP3 listener (off by default) that serves the mail SendMock caught, per project, with the commands mail clients and `poplib` use.",
    outcome:
      "Test a feature or a script that reads a mailbox over POP3 against SendMock, without changing it.",
  },
  "SM-01": {
    summary:
      "A native SMS API to send messages and read them back, with status and metadata.",
    outcome: "Apps and tests capture SMS locally with one simple API.",
  },
  "SM-02": {
    summary:
      "Emulation of Twilio's Messages API, including its response bodies, error codes and SDK behaviour.",
    outcome:
      "Apps using Twilio's SDK send SMS to SendMock by changing only the base URL and credentials.",
  },
  "SM-03": {
    summary:
      "Twilio Messaging Services with sender pools and their inbound and status callback settings.",
    outcome:
      "Apps that send through a Messaging Service SID work against SendMock unchanged.",
  },
  "SM-04": {
    summary:
      "Emulation of the Vonage SMS API, with Vonage's response shapes and delivery receipts.",
    outcome: "Apps using Vonage send to SendMock without code changes.",
  },
  "SM-05": {
    summary:
      "Plivo and MessageBird emulation, plus a generic GET or POST vendor with configurable parameter names.",
    outcome: "Apps using regional or less common SMS vendors are captured too.",
  },
  "SM-06": {
    summary:
      "GSM-7 and UCS-2 encoding detection and segment counting, shown on every message.",
    outcome:
      "See how many segments a message costs and catch characters that switch its encoding.",
  },
  "SM-07": {
    summary:
      "Simulated SMS delivery with profiles, failure rates and Twilio's official magic test numbers and error codes.",
    outcome:
      "Test delivery failures and edge cases with the same numbers Twilio documents.",
  },
  "SM-08": {
    summary:
      "Status callbacks to the app's URL as a message moves through queued, sent, delivered or failed, with retries.",
    outcome: "Exercise delivery-receipt handlers locally.",
  },
  "SM-09": {
    summary:
      "Inbound SMS and threaded two-way conversations, with the reply webhook and TwiML answers handled as Twilio does.",
    outcome: "Build and test SMS bots and two-way flows without a phone.",
  },
  "SM-10": {
    summary:
      "`sms.opened` (read) events and Twilio's `read` status for messages opened in SendMock.",
    outcome: "Test read-receipt handling locally.",
  },
  "SM-11": {
    summary:
      "WhatsApp messages through Twilio's Messages API with `whatsapp:` addresses, media and templates.",
    outcome: "Test WhatsApp flows built on Twilio without Meta's sandbox.",
  },
  "SM-12": {
    summary: "Virtual phone numbers with their own inbound URLs and settings.",
    outcome:
      "Model the numbers an app owns and route inbound messages to the right handler.",
  },
  "SM-13": {
    summary:
      "A log of every request to the native and provider APIs, rejected ones included, with credentials masked.",
    outcome: "See exactly what an SDK sent and what SendMock answered.",
  },
  "SM-14": {
    summary:
      "A provider port (`--provider-addr`) where provider routes answer at their real root paths, and the same routes under `/providers/<name>/`.",
    outcome:
      "Point an SDK at SendMock with only a base URL change, even when the SDK hard-codes paths.",
  },
  "SM-15": {
    summary:
      "MMS with media: thumbnails and files in the UI, `MediaUrl` fields in webhooks, and media in replies.",
    outcome: "Test picture messages and attachments end to end.",
  },
  "SM-16": {
    summary:
      "SMS providers defined as configuration (built-in or custom), with routes, auth, mappings and responses.",
    outcome:
      "Add a provider SendMock does not ship without waiting for a release.",
  },
  "SM-17": {
    summary:
      "Infobip, Telnyx, Sinch, Africa's Talking and Amazon SNS as built-in SMS providers: their send APIs, answers, errors and delivery reports in their own shapes.",
    outcome:
      "Point an app that sends SMS through one of these providers at SendMock with no code change.",
  },
  "VF-01": {
    summary:
      "Verify services, as in Twilio Verify, with code length, TTL, channels and fixed codes per service or globally.",
    outcome:
      "Configure one-time-code flows exactly as the app uses them in production.",
  },
  "VF-02": {
    summary:
      "Starting a verification creates a code and delivers it as an SMS or email into SendMock.",
    outcome:
      "Run sign-in and two-factor flows locally and read the code like a user would.",
  },
  "VF-03": {
    summary:
      "Checking a verification approves the right code and rejects wrong, expired or exhausted attempts with Twilio's errors.",
    outcome: "Test every branch of a verification flow.",
  },
  "VF-04": {
    summary:
      "Forcing a verification's state (approve, expire, cancel) and emitting verify events.",
    outcome: "Reach rare states in tests without waiting for timeouts.",
  },
  "VF-05": {
    summary:
      "Vonage Verify v2: start a verification, deliver its code into SendMock and check it, in Vonage's own request and answer shapes.",
    outcome:
      "Test a login flow that uses Vonage Verify without sending a real code.",
  },
  "WH-01": {
    summary:
      "Webhook endpoints with URLs, headers, secrets, timeouts, retry policies and health at a glance.",
    outcome:
      "Point SendMock's events at an app's handlers and see whether they are working.",
  },
  "WH-02": {
    summary:
      "Rules that choose which events go to which endpoints, with filters on any event field and a live preview.",
    outcome: "Send only the events a handler needs, in the shape it expects.",
  },
  "WH-03": {
    summary:
      "A delivery engine with queued attempts, exponential retries, a full delivery log and cancellation.",
    outcome: "Test idempotency and retry handling, and inspect every attempt.",
  },
  "WH-04": {
    summary:
      "Native webhooks signed with Standard Webhooks, verified by its official libraries.",
    outcome: "Use the same verification code locally and in production.",
  },
  "WH-05": {
    summary:
      "Sending a webhook by hand, with a template, a hand-written request or an edited body, and replaying past deliveries.",
    outcome:
      "Reproduce a specific webhook on demand while debugging a handler.",
  },
  "WH-06": {
    summary:
      "Provider webhook formats and signatures (Twilio, SendGrid, Mailgun, Postmark, Svix-based and others) produced as the providers send them.",
    outcome:
      "Test provider webhook handlers, signature checks included, without the provider.",
  },
  "WH-07": {
    summary:
      "Variables and a template language for webhook requests: event data, secrets, environment values, fake data and filters.",
    outcome: "Shape any webhook an app expects without writing code.",
  },
  "WH-08": {
    summary:
      "A catalogue of built-in payload templates for common providers and events.",
    outcome: "Start from a realistic payload instead of a blank page.",
  },
  "WH-09": {
    summary:
      "Custom webhook templates with revisions, import and export, and a templates folder.",
    outcome: "Keep team-specific payloads in version control and share them.",
  },
  "WH-10": {
    summary:
      "Saved deliveries that survive pruning and reset, and can be resent or turned into templates.",
    outcome: "Keep the webhooks that reproduce tricky bugs.",
  },
  "WH-11": {
    summary:
      "Webhook metrics: success rate, latency, failure codes and per-endpoint health.",
    outcome: "Spot a failing or slow handler at a glance.",
  },
  "WH-12": {
    summary:
      "Mailgun-style inbound routes that match recipients and headers and forward, store or stop.",
    outcome: "Test inbound-email routing as Mailgun runs it.",
  },
  "HC-01": {
    summary:
      "An HTTP catcher that captures any request sent to a bin URL or the catch-all port, with headers, body and timing.",
    outcome:
      "Point outgoing webhooks or API calls at SendMock and inspect exactly what was sent.",
  },
  "HC-02": {
    summary:
      "Mock responses for captured requests: status, headers, body, delays and failure rates, chosen by rules.",
    outcome:
      "Stand in for a third-party API and test how an app handles its answers and outages.",
  },
  "HC-03": {
    summary:
      "Presets for Slack, Discord, Teams, Google Chat, Telegram, FCM, Expo and OneSignal that answer as those services do.",
    outcome:
      "Test chat and push integrations without real workspaces or devices.",
  },
  "PL-01": {
    summary:
      "A versioned REST API for everything SendMock does, described by a published OpenAPI document.",
    outcome:
      "Automate SendMock from any language and generate clients from the spec.",
  },
  "PL-02": {
    summary:
      "Realtime updates over WebSocket for new messages, events and deliveries.",
    outcome: "The UI and tools update live, with no polling.",
  },
  "PL-03": {
    summary:
      "Test helpers: wait for an email, SMS, request or webhook, read the latest code or link, and send samples.",
    outcome: "Write fast, reliable end-to-end tests without sleeps.",
  },
  "PL-04": {
    summary:
      "A seed file that sets up endpoints, rules, providers, numbers and settings at startup, and a reset that returns to it.",
    outcome: "Every developer and CI run starts from the same known state.",
  },
  "PL-05": {
    summary:
      "Settings for every area, changed in the UI or API and applied without a restart.",
    outcome:
      "Adjust behaviour while working, without editing files or restarting.",
  },
  "PL-06": {
    summary:
      "Safe defaults: bound to localhost, secrets masked everywhere, nothing sent to the internet unless allowed.",
    outcome: "Run SendMock without leaking credentials or messages.",
  },
  "PL-07": {
    summary:
      "Configuration through flags, `SENDMOCK_*` environment variables and `sendmock.toml`, validated at startup.",
    outcome:
      "Configure SendMock the way each environment prefers, with clear errors.",
  },
  "PL-08": {
    summary:
      "Retention limits by count and age for all traffic, pruned in the background.",
    outcome:
      "Run SendMock for weeks without the data store growing without bound.",
  },
  "PL-09": {
    summary:
      "`sendmock serve --demo` fills a fresh instance with realistic sample data.",
    outcome:
      "Explore every screen immediately, or demo SendMock without wiring up an app.",
  },
  "PL-10": {
    summary:
      "Projects inside one instance: mail, SMS and codes kept apart by SMTP username, a header or a URL prefix, with a project switcher in the UI.",
    outcome:
      "Share one SendMock across apps or developers without reading each other's messages.",
  },
};
