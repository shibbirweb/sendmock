# Changelog

All notable changes to SendMock are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

Write every user-visible change under **Unreleased** in the same pull request that makes it. The Prepare release workflow publishes those notes as they are with each beta, and dates them into a `## [x.y.z] - YYYY-MM-DD` section for a stable release. That section becomes the GitHub release notes and the website's changelog.

## [Unreleased]

### Added

- **Why a Twilio request was refused:** a Twilio 401 still answers Twilio's `20003` body, and its entry in Logs > HTTP requests now says why: a wrong auth token, an unknown account, or a subaccount's token used under another account's path (the `note` field in `GET /api/v1/logs/http`).
- **Numbers owned by a Twilio subaccount:** a number can now belong to the main Twilio account or one of its subaccounts, chosen with **Twilio account** in the number sheet (Numbers), `sendmock numbers add --account-sid`, `account_sid` in the API and MCP, and `account_sid` on `[[numbers]]` in a setup file (exported too). A number's inbound method is POST when left out, as on Twilio, and `sendmock sms services create --sid MG...` (or `sid` in the API) keeps the Messaging Service SID your app is configured with.
- **Simulate with your app's own ids:** the Simulate open, click, bounce and complaint actions take user variables (in the Choose webhooks dialog, `--user-variables` in the CLI, `user_variables` in the API and MCP), merged into the webhook payload before it is signed, so SMTP-sent mail can be tested with your app's order or customer ids. See Mail, Outcomes.
- **Mail > Templates:** a new screen, with `sendmock email templates`, `/api/v1/emails/templates` and MCP tools, to list, add, change and delete local stand-ins for your provider's email templates. A SendGrid, Postmark or Mailgun send that names one is stored with its subject and bodies, and Mailgun's `GET /v3/{domain}/templates/{name}` answers from them. See Mail, Templates.
- **Mailgun stored messages:** `GET /v3/domains/{domain}/messages/{key}` on the provider port answers Mailgun's full stored-message shape, found by the id the send answered as well as SendMock's id, and each Mailgun event has a `storage` field pointing at it.
- **Mailgun webhooks with variables and delivery status:** `mailgun.events` webhooks now carry the email's `user-variables` on every event, and `severity`, `reason` and `delivery-status` on failures. A simulated soft bounce is a `temporary` failure with code 452, a hard bounce `permanent` with 550, in webhooks and the events API alike. Webhook templates read a bounce as `data.bounce.type`, `code`, `enhanced_code`, `message` and `severity`, also when previewing or rendering a bounced email.
- **Mailgun template sends and user variables:** a Mailgun send with `template` and no body is accepted and keeps its template name and data. `v:` fields and `X-Mailgun-Variables` (also inside `/messages.mime`) are kept as the email's user variables, shown in the email API and read by webhook templates as `data.user_variables`. The id the send answered is kept as `provider_message_id`, and the `mailgun.events` webhook sends it, so your app can match the webhook to its send. See Mail providers, Mailgun templates, variables and message ids.
- **Startup banner:** starting SendMock in a terminal (`sendmock`, `sendmock serve`, `--last`, `--services`) first prints its wordmark in braille dots with the version under it, sized to the terminal's width and in colour where the terminal supports it. Pipes, files, `--ready-json`, `--log-format json` and `sendmock mcp` print exactly what they did before. Turn it off with `--no-banner`, `SENDMOCK_NO_BANNER=1` or `banner = false` in `sendmock.toml`; see the Configuration guide, The startup banner.

### Changed

- **Viewing an email no longer reports an open to your app by default:** when a webhook rule would send `email.opened`, opening the email in Mail is not counted as an open; the viewer says so and offers Count as an open. **Count views your webhook rules would report** in Settings > Email brings back the old behaviour.
- **Email template keys are checked:** a `[[email.templates]]` item with an unknown key, such as `template_id`, is refused by setup validate and import with the key named, instead of importing as an empty template.
- **Mailgun inbound forwards and template events:** the `mailgun.routes` webhook now sends Mailgun's full store-and-notify form, with `To`, `Message-Id`, `In-Reply-To`, `References`, the stripped text and signature, `message-headers`, `content-id-map`, `message-url` and the attachments. The inbound templates are now listed for `email.inbound` (mail sent to your app), and `mailgun.events` and `postmark.webhooks` for delivery events only. Choosing an endpoint whose template is not made for the simulated event shows a warning in the webhook picker.
- **Change one field at a time:** PATCH on providers, numbers, Messaging Services, Verify services, Twilio subaccounts, inbound routes, payment flows, gateways and methods, webhook variables and HTTP bins now takes only the fields you change (`sendmock numbers update <numberId> --label Marketing`, or a partial JSON body); the rest stay as they were, and a left-out or masked secret keeps its value. Previewing an unsaved webhook endpoint fills in every field you leave out.
- **Setup validate catches what import refuses:** `sendmock setup validate` (and Preview in Settings > Setup) now reads every item the way an import does, so an unknown key or a wrong type is reported with its place before you import, instead of only when the import runs.
- **Merge imports no longer ask to confirm:** `sendmock setup import` needs no `--yes` for a merge, which only adds and updates. A replace that would remove items names each one and asks you to run it again with `--confirm-removed-count <count>`.
- **Reset says what it did:** `sendmock reset` and `POST /api/v1/reset` answer what they cleared (emails, SMS, deliveries and the rest) and which configuration stayed, instead of an empty answer. The new `--config` option also removes every configured item and puts the settings and providers back to what SendMock ships with, after you confirm the counts it names; see Seed file, Reset before every test run.
- **The provider port is on by default:** `sendmock serve` now serves the provider APIs (Twilio, Mailgun, SendGrid, ...) at `127.0.0.1:8026` without `--provider-addr`, so provider SDKs reach SendMock with no extra flag. `--provider-addr none` (or `SENDMOCK_PROVIDER_ADDR=none`, or `provider_addr = "none"` in `sendmock.toml`) turns it off, and if port 8026 is busy SendMock says so and starts without it. `sendmock status`, `GET /api/v1/info` and the MCP status tool warn while it is off. The Docker image and the Helm chart keep it off until you set its address.
### Fixed

- **Twilio messages stay in their account:** on the Twilio API, fetching, canceling or listing messages under `/Accounts/{AccountSid}/` now sees only that account's messages, so the main account gets Twilio's 20404 for a subaccount's message instead of reading it as its own, and every answer names the account that really sent it.
- **Inbound SMS name the right Twilio account:** a text to a number owned by a Twilio subaccount is stored under that subaccount, its `twilio.inbound_sms` webhook carries the subaccount's `AccountSid` and is signed with its token, and TwiML replies to it are sent under the same account. Webhook rules on `twilio.inbound_sms` and `twilio.status_callback` now send the message's account (or the main account) as `AccountSid` instead of a placeholder SID.
- **Location fields on Twilio inbound webhooks:** `twilio.inbound_sms` now always sends `FromCity`, `FromState`, `FromZip`, `FromCountry`, `ToCity`, `ToState`, `ToZip` and `ToCountry`, as Twilio does; the countries come from each number's calling code and the rest are empty.

## [1.4.1] - 2026-11-22

### Fixed

- **Percent-encoded paths on the provider port:** an address in a provider path, such as `DELETE /v3/{domain}/complaints/user%40example.org`, now finds the item as the unencoded address does.
- **Secure tokens for demo Twilio subaccounts:** in the website's demo and the web UI's mock mode, a new Twilio subaccount's auth token and SID now come from the browser's cryptographically secure random source instead of `Math.random()`.

## [1.4.0] - 2026-11-22

### Added

- **Twilio subaccounts:** the Twilio provider has subaccounts, each with its own SID, auth token and status, on a new Accounts tab of SMS > Providers > Twilio, through `sendmock sms twilio subaccounts`, the REST API, MCP and the seed file. The provider port answers Twilio's Accounts API (`/2010-04-01/Accounts.json` and `/Accounts/{AccountSid}.json`), so an app can read a subaccount's token the way it does on Twilio. Status callbacks and inbound replies for a message sent under a subaccount are signed with that subaccount's token, and a send under a suspended or closed subaccount is refused with Twilio's error.
- **Twilio phone numbers:** the provider port answers Twilio's IncomingPhoneNumbers API (`/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers.json`: list, create from a number or an area code, fetch, update and delete) and a Messaging Service's PhoneNumbers (`/v1/Services/{ServiceSid}/PhoneNumbers`: list, add, fetch and remove), over the same numbers and sender pools as the Numbers screen. Each number has a `PN` SID and belongs to the account it was created under.
- **Twilio Debugger webhook:** set a Debugger webhook URL on the Twilio provider (`debugger_url`) or on a subaccount, and a message that ends failed or undelivered, or a status callback or inbound URL that fails, sends one Twilio Debugger event, signed with the account's token, shown on the message's timeline and retried like a status callback. The new `twilio.debugger` webhook template can also be picked for any endpoint.
- **Mailgun events and complaints:** the provider port answers Mailgun's events API (`GET /v3/{domain}/events`, with its filters and paging) from the emails sent through Mailgun for that domain and their outcomes, and its complaints API (`/v3/{domain}/complaints`). A complaint simulated in SendMock puts the address on the domain's complaints table, and a later send to it is accepted but recorded as failed with reason `suppress-complaint`, as Mailgun does. List and clear complaints with `sendmock email mailgun complaints`, the REST API or MCP.
- **HTTPS on the provider port:** `--provider-tls-addr` (`SENDMOCK_PROVIDER_TLS_ADDR`) serves the provider APIs over HTTPS next to the plain provider port, for SDKs that only speak HTTPS, such as Laravel's `mailgun` mailer. SendMock makes a local CA once, limited to the names it serves, and `sendmock tls ca`, `GET /api/v1/tls/ca` and Settings > Connection hand it out; use your own certificate with `--provider-tls-cert` and `--provider-tls-key`. The new "HTTPS for provider SDKs" page gives the steps to trust the CA on each system and runtime.
- **HTTP Catcher bins on a provider's own URL:** a request your app sends to a provider endpoint SendMock does not implement, such as Twilio's `Calls.json`, can now be answered on the same base URL. On a provider's General tab (Mail, SMS or Payments), **Unmatched requests** sends them to an HTTP Catcher bin (**Create a bin for this provider** makes one), whose response rules answer them; built-in endpoints still answer first. A rule can also send a **follow-up webhook** after it answers, to a URL from the request (such as Twilio's `StatusCallback`) or an endpoint, with any webhook template, so a vendor's signed callback arrives too. The bin lists the providers that send to it, the API request log names the bin and rule that answered, and `sendmock http provider-bin`, the REST API, MCP, the `fill-provider-gap` prompt and `[[http.provider_bins]]` in the seed file do the same. See the new "Provider gaps" page.
- **Interactive launcher:** run `sendmock` alone in a terminal and it asks which services to start (SMTPS, the provider APIs over HTTP and HTTPS, the HTTP Catcher port and POP3, with the web UI, API, MCP and SMTP always on), lets you change their ports, remembers the answer and starts it again with Enter twice. `sendmock --last` and `sendmock mcp --embedded --last` start the saved choice without asking, `sendmock --services smtp,catcher,pop3` starts named services, `sendmock last-run` shows or clears the saved choice, and `--no-input` (`SENDMOCK_NO_INPUT=1`, set in the Docker image) never asks. Scripts, pipes, CI and any command with options run as before. See "Choose what starts" on the Configuration page.
- **Load a setup at startup:** `--setup <path|url>` (`SENDMOCK_SETUP`) applies a setup file in TOML, JSON or YAML, or downloads it from a URL, when SendMock starts, and SendMock reports ready only once it is applied, so a CI service container needs one environment variable. `--setup-sha256` pins the download and `--setup-header` adds headers for a private URL.
- **Webhook tests in CI:** a CI file (`format: sendmock.ci`, JSON or YAML) names the setup, your app's URL and the scenarios; `sendmock ci run` runs it against its own SendMock (or `--server`), writes a JUnit report (`--junit`), a JSON report and a GitHub step summary, and exits `0`, `5` when a scenario fails or `2` when a file is invalid. `sendmock ci init` writes the setup, a starter CI file and the job for GitHub Actions, GitLab CI, CircleCI, Bitbucket Pipelines, Azure Pipelines or Jenkins. New scenario steps check the webhooks your app sends: `http.request.wait`, `webhook.signature.verify` (Standard Webhooks, Stripe or an HMAC header) and `assert` with a JSONPath; scenarios can be JSON or YAML too. The Scenarios screen runs a CI file and downloads its JUnit report, Settings > Setup has a **Use in CI** card, a captured request has **Verify signature**, MCP has `sendmock_ci_init`, `sendmock_ci_validate`, `sendmock_ci_run` and the `setup-ci` prompt, and the new "Webhook tests in CI" page has a job for seven CI systems.

### Fixed

- **One-time codes named after "is your":** a code followed by a few words before the word for it, such as `909582 is your App login code`, is now found in SMS messages and in email, including a code that appears only in an email's subject.
- **Mailgun MIME sends:** Mailgun's `/v3/{domain}/messages.mime` send is answered and stored like `/v3/{domain}/messages`, so Laravel's `mailgun` mailer (Symfony's default Mailgun transport, which sends the whole MIME message) works against SendMock.

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
