# Changelog

All notable changes to SendMock are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

Write every user-visible change under **Unreleased** in the same pull request that makes it. The Prepare release workflow publishes those notes as they are with each beta, and dates them into a `## [x.y.z] - YYYY-MM-DD` section for a stable release. That section becomes the GitHub release notes and the website's changelog.

## [Unreleased]

### Added

- **Twilio subaccounts:** the Twilio provider has subaccounts, each with its own SID, auth token and status, on a new Accounts tab of SMS > Providers > Twilio, through `sendmock sms twilio subaccounts`, the REST API, MCP and the seed file. The provider port answers Twilio's Accounts API (`/2010-04-01/Accounts.json` and `/Accounts/{AccountSid}.json`), so an app can read a subaccount's token the way it does on Twilio. Status callbacks and inbound replies for a message sent under a subaccount are signed with that subaccount's token, and a send under a suspended or closed subaccount is refused with Twilio's error.
- **Twilio phone numbers:** the provider port answers Twilio's IncomingPhoneNumbers API (`/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json`: list, create from a number or an area code, fetch, update and delete) and a Messaging Service's PhoneNumbers (`/v1/Services/{ServiceSid}/PhoneNumbers`: list, add, fetch and remove), over the same numbers and sender pools as the Numbers screen. Each number has a `PN` SID and belongs to the account it was created under.

### Fixed

- **One-time codes named after "is your":** a code followed by a few words before the word for it, such as `909582 is your App login code`, is now found in SMS messages and in email, including a code that appears only in an email's subject.

## [1.3.1] - 2026-11-21

### Added

- **Website footer wordmark:** the website's landing, changelog, reference and playground pages end with a large SendMock wordmark drawn in small squares that show how many times SendMock was downloaded on each of the last 7 days (npm, crates.io and PyPI), oldest day on the left and the busiest day brightest. Move the pointer near it and a soft light brightens the squares; on phones and tablets it rests still.

### Changed

- **Testcontainers for Go needs Go 1.26:** the `sendmock-testcontainers` Go module moves to patched releases of its dependencies (OpenTelemetry 1.47, `klauspost/compress`, `moby/go-archive`, `moby/sys/user`), and OpenTelemetry 1.47 requires Go 1.26. The Python module's test dependency moves to pytest 9.

### Fixed

- **Chocolatey package details:** the `sendmock` Chocolatey package names its copyright holder and links the release's license file, as Chocolatey's reviewers asked.

## [1.3.0] - 2026-11-20

### Added

- **Share and move a setup:** **Settings > Setup** (formerly **Settings > Seed**) exports everything you configured, without traffic, as one file in TOML, JSON or YAML, all sections or only some. Secrets come out as `${ENV_VAR}` references, or encrypted with a passphrase to carry your own setup to another machine. **Import a setup** takes a file, pasted text or an `https://` URL (with an optional SHA-256 and headers for a private address), previews what it would add, change and remove, then merges it or replaces your configuration after a confirmation that names how many items go. A file from an older SendMock is upgraded for the import, and one from a newer SendMock is refused with the version to update to. The same from the command line with `sendmock setup export|validate|import|migrate`, the REST API under `/api/v1/setup/` and the `sendmock_setup_*` MCP tools.
- **Saved scenarios:** the **Scenarios** screen keeps scenarios by name in a **Saved** list beside the editor: save, save as, open, rename and delete them, with an **Unsaved changes** mark while the editor differs. A saved scenario runs by its name with `sendmock scenario run-saved <name>` and travels in a setup.
- **Attachments under the message:** in **Mail**, the HTML and Text views of an email list its attachments below the message, with each file's name, size and a download link, so you see that an email has attachments without opening the **Attachments** tab.

### Fixed

- **Demo version:** the demo at https://shibbir.me/sendmock/demo/ shows the version it was built from (the newest release on the main site) instead of an old beta. Its update check, in **Settings > About** with an older install picked in **Demo controls**, offers the real releases with their real release notes.

## [1.2.0] - 2026-11-16

### Added

- **Website in search and link previews:** every page of https://shibbir.me/sendmock/ has a canonical link, Open Graph and Twitter card tags with a preview image, and structured data, and `sitemap.xml` lists every current page. Older docs versions and `/next/` point search engines to the current pages.
- **What's new and Upgrade guide in the docs:** under the **Version** menu of every docs version, **What's new** shows that version's release notes and **Upgrade guide** shows how to upgrade on your install channel and what to change, if anything.

### Fixed

- **Chocolatey package:** shows the SendMock icon, links to its source and to the website at https://shibbir.me/sendmock/, and its description no longer holds a local address that Chocolatey's checks flag.
- **`cargo install sendmock`:** each stable release reaches crates.io again. 1.1.0 was released everywhere else but not to crates.io.
- **APT and YUM repositories:** the website deploy, which also publishes the `apt` and `dnf` repositories, no longer stops at the docs of an older version (`/v1.0/`), so `apt install sendmock` and `dnf install sendmock` get the newest stable.

## [1.1.0] - 2026-11-16

### Added

- **List actions on every screen:** Mail, SMS, Verify, Push, the HTTP Catcher, webhook deliveries, Payments, Subscriptions and both Logs tabs share one toolbar above the list. Tick rows (or press **x** on the open or focused row) to **Mark read**, **Mark unread** or **Delete** them, and **Delete all** empties the list, or only what the search or filters show, in the picked project, after one confirmation that says what goes and what stays. Webhook deliveries still queued or retrying are kept.
- **Read state for SMS, push and HTTP requests:** conversations, push notifications and captured requests arrive unread, opening one marks it read, and the sidebar counts the unread ones, as it does for Mail.
- **Delete all traffic:** Settings > General deletes every email, SMS, verification, push notification, captured request, finished delivery, payment, subscription and log entry in one go, and keeps your settings and configuration (`DELETE /api/v1/traffic`, `sendmock traffic delete-all --yes`).
- Each of these is also in the API, the CLI and the MCP tools, such as `sendmock sms threads update <threadId>`, `sendmock verify delete-all --yes` and `sendmock_webhook_delivery_delete_all`.

### Fixed

- **Sidebar version:** the version at the bottom of the sidebar is now the one SendMock is running, the same as Settings > About shows. It said `v0.0.0-dev` on every install.
- **crates.io pages:** every SendMock crate on crates.io now has a README. `sendmock-tray` shows how to install and start the tray app (`cargo install sendmock-tray --features gui --locked`), and each library crate says what it does, that it is an internal part of SendMock without a stable API, and how to install SendMock.

## [1.0.0] - 2026-11-14

### Added

- SendMock catches the email, SMS, push notifications, payments and webhooks your app sends while you develop and test, and shows them in a web UI at http://127.0.0.1:8025. Your app talks to it over SMTP and the providers' own HTTP APIs, so nothing reaches a real inbox, phone or payment provider. `sendmock --demo` starts it with sample data to look around.
- **Email:** an SMTP server on port 1025 (with STARTTLS, AUTH and a size limit), the send APIs of SendGrid, Mailgun, Postmark, Resend, Amazon SES and Brevo, a native `POST /api/v1/send`, a `sendmail` shim and a Mailpit-compatible API. Each email shows its HTML, text, source, headers and attachments, with link and spam checks, and one-time codes and links pulled out for your tests.
- **Email outcomes:** simulate delivered, bounced, deferred, spam complaint and unsubscribe, by hand or with outcome addresses and rules, and send the matching webhooks in each provider's own format. Reply, reply all or forward as the recipient to test inbound mail, and read the mailbox over POP3 (`--pop3-addr`).
- **Release to a real inbox:** send one real copy of a caught email through your SMTP relay, or forward arriving emails with auto-forward rules, only to the recipients you allow.
- **SMS and verification codes:** the APIs of Twilio (Messages, Messaging Services and Verify), Vonage (SMS and Verify v2), AWS SNS, Infobip, Sinch, Africa's Talking, MessageBird and Telnyx, shown as conversations with delivery status, status callbacks and replies. Twilio's official test numbers fail exactly as on Twilio, and WhatsApp Business Cloud API messages, media and webhooks work too.
- **Push notifications:** FCM HTTP v1, Expo and OneSignal sends, with an iOS and Android lock screen preview and magic tokens for each provider's failures.
- **Payments:** Stripe, PayPal, Razorpay, Paddle, bKash, SSLCommerz and your own gateways, with a hosted test checkout page, subscriptions, refunds and disputes, and simulated outcomes that send the provider's webhooks.
- **Webhooks back to your app:** rules that send Standard Webhooks or a provider's own format on any event, with templates, variables, signing secrets, retries with backoff, a delivery log, replay and saved deliveries, and inbound routes like Mailgun's.
- **Where a simulated reply goes:** the Reply and Forward composers in Mail show **Delivers to**, each URL or address the inbound routes and webhook rules will send the email to, and when nothing would, **Send replies to your app** creates a route to your app's URL in one step. After sending, the notice and the incoming email list each webhook request with its status, linked to Webhooks > Deliveries. Send reply works on the prefilled text, even with an empty message box. `sendmock route match` and `POST /api/v1/inbound-routes/match` answer the same question from the CLI and API.
- **Icon tooltips:** every button or link in the web UI that shows only an icon names its action in a tooltip when you hover or focus it, with its keyboard shortcut when it has one (for example **Delete email** `D`). The `?` shortcut list now also shows the list and email keys (`J`, `K`, `/`, `D`, `R`, `Shift+R`, `F`).
- **Webhooks on every simulation:** each action that simulates traffic (Mail's Simulate menu, Reply, Reply all and Forward, Import .eml as incoming, the Send a sample buttons, SMS's Simulate read, Set status and Reply as recipient, and a payment's Simulate menu) names the webhooks its event will trigger, each opening the endpoint in a new tab, or says No webhook. **Change** in a composer or **Choose** beside a menu item sends that one action to the endpoints you pick instead, without changing any rule; the deliveries are marked `chosen`. In the API and MCP the same operations take `webhook_endpoint_ids`, in the CLI `--webhook`, and `sendmock webhook rule match` (`POST /api/v1/webhooks/rules/match`) answers which webhooks an event would trigger.
- **Payload on every simulated webhook:** **Payload** beside each webhook a simulation names (and beside each endpoint ticked in **Choose**) shows the request it will send, rendered with the endpoint's template, and lets you edit the body for that one action. The edited body is sent exactly as written and signed over those bytes, so your app's signature check still passes, and the delivery is marked `edited` in Webhooks > Deliveries. `POST /api/v1/webhooks/rules/match` returns the requests with `include_requests`, and the simulating operations take the edits as `webhook_requests` (`--webhook-requests` in the CLI).
- **Test builds:** every pull request, and every change merged into `develop` or `main`, builds SendMock for macOS, Linux and Windows (x64 and Arm64), tests each build on its own system and attaches it to the workflow run, linked from a comment on the pull request. Install > Try a build that is not released yet says how to download, check and run one.
- **HTTP catcher:** bins that capture any request your app sends (Slack, Discord, Teams, Telegram and more), with previews and mock responses, and a catch-all port (`--catcher-addr`).
- **Projects:** keep the mail, SMS and codes of several apps apart in one SendMock, picked by the SMTP username, a header or a URL prefix.
- **For tests and CI:** wait for the next email or SMS and read its code or link over the REST API, the CLI or MCP; reset to a seed file (`sendmock.seed.toml`) before each run; and script whole flows as scenarios. Testcontainers modules for Node.js, Python, Go, Java and .NET start SendMock inside your tests.
- **Every feature in four ways:** the web UI, a REST API described by OpenAPI, the `sendmock` CLI with `--json` output, and an MCP server for AI agents. `sendmock ai install` sets SendMock up in Claude Code, Codex, Cursor, Gemini CLI or VS Code with its agent skill, and Claude Code users can install it as a plugin.
- **Retention:** keep the newest 1,000 emails and 1,000 SMS by default, change the limits with `--max-emails`, `--max-sms` or `--max-age`, or set a limit to 0 to keep everything (with a warning, since the database then grows until the disk is full).
- **Safe by default:** SendMock listens on 127.0.0.1 only, can require a login (`--ui-auth`) or an API token (`--api-token`), and masks secrets in the UI, API answers, logs and seed exports.
- **Install your way:** `npx sendmock` or `bunx sendmock` with nothing installed, Docker (GHCR and Docker Hub, signed, with an SBOM), Homebrew, Scoop, WinGet, Chocolatey, apt, dnf, Nix, Cargo, an install script or a plain binary for macOS, Linux and Windows on x64 and Arm. A Helm chart, a Docker Desktop extension and a menu bar app are there too.
- **Docs:** a guide for every screen and setting, a page that explains every control, recipes in nine languages, the API, CLI and MCP references and a live demo, at https://shibbirweb.github.io/sendmock/.

### Fixed

- **Live updates under load:** the mail list keeps showing new mail while an app sends thousands of emails, and toasts and browser notifications show at most one every 2 seconds, saying how many more arrived.
- **Package repository:** the APT and YUM repository at https://shibbirweb.github.io/sendmock/packages/ is now published with each release, so `apt install sendmock` and `dnf install sendmock` with the beta component work as the [install page](https://shibbirweb.github.io/sendmock/docs/install/) shows.
- **npm and Maven Central:** the `sendmock` package on npm (for `npx sendmock@beta` and `bunx sendmock@beta`) and the Java Testcontainers module `io.github.shibbirweb:sendmock-testcontainers` on Maven Central are published with each release.
- **`npx sendmock` with no tag:** until 1.0.0, each beta is also npm's `latest` version, so `npx sendmock` and `bunx sendmock` run the newest beta instead of an empty placeholder package.
- **Lists after retention:** when retention deletes old traffic past the limits in Settings, the open lists, their counts and the sidebar badges update right away, instead of showing deleted emails until you reload the page.
