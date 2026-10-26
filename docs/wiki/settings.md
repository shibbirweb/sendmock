---
title: Settings
description: How SendMock behaves. Retention, the seed file, email and SMS outcomes, payments, notifications, chaos, OTP patterns and connection snippets.
---

> Try it in the [demo](/demo/settings). Works in your install from Phase 0 (the server settings), with each section arriving with its feature.

Settings decide how every capture menu behaves. They take effect at once, without a restart.

![The Settings screen](./images/settings.jpg)

## What it solves

| Section | Solves |
| --- | --- |
| [General](#general) | the database growing forever; starting clean |
| [Seed](#seed) | the same setup for every teammate and every CI run |
| [Email](#email) | bounce and complaint tests, reply domains, safe release to real SMTP |
| [SMS](#sms) | failure and delay tests, matching Twilio's test credentials |
| [Payments](#payments) | the merchant name, currency, automatic outcomes for automated tests, the test values to type |
| [Notifications](#notifications) | pop-ups while you work, or the bell only |
| [Opened events](#opened-events) | testing read receipts and open tracking |
| [Chaos](#chaos) | testing your app when the mail server rejects, is slow or drops the connection |
| [OTP patterns](#otp-patterns) | your app's code format is not found by default |
| [Connection](#connection) | the exact settings your app needs, per language and per place it runs |
| [About](#about) | version, listeners and updates |

## How it connects

| Gets from | Sends to |
| --- | --- |
| your choices, or the [seed file](./advanced/seed-file.md) | [Mail](./mail/index.md): outcome addresses, delivery profile, inbound domains, relay |
| | [SMS](./sms/index.md): simulation profile, failure rate, outcome numbers |
| | [Payments](./payments/index.md): merchant name, currency, automatic outcome |
| | every screen: retention, notifications, opened events, OTP patterns |

## Use it

1. Press `G ,` and pick a section on the left (a picker on phones). The section is kept in the URL, for example `/settings?section=sms`.
2. Change a value. **Save changes** turns on; **Discard** puts the old values back.
3. Press **Save changes**. Invalid values show a message under the field.

## Everything on this screen

### General

**Retention:** **Keep at most** a number of emails and SMS, and **Delete traffic older than** a number of days, or **Keep forever**. Older traffic is pruned when a limit is reached; configuration is never pruned. **Danger zone:** **Delete all emails**, **Delete all SMS** and **Reset to seed** (deletes all traffic and restores the seed file), each asking first.

### Seed

The seed file (`sendmock.seed.toml`) is the configuration SendMock starts from and resets to, kept in your repository. The card shows its path, when it was applied, and what changed since. **Export** downloads the current configuration (secrets written as `${ENV_VAR}` references, never in plain text). **Apply a seed file** takes an upload or pasted text; **Validate** lists errors with line numbers and a summary of the changes before you confirm. See [Advanced: seed file](./advanced/seed-file.md).

### Email

- **Receiving and delivery outcomes:** **Tag by plus address** (`user+invoice@app.test` gets the tag `invoice`), the delivery profile (**Off**, **Auto-delivered**, **Realistic** with a **Bounce rate** and **Complaint rate**), **Inbound domains** (mail to them arrives as incoming, for [inbound routes](./webhooks/inbound-routes.md)) and **SpamAssassin address** (empty means no spam score).
- **Magic addresses:** the switch, and the reference table of the SES simulator and SendMock addresses ([Outcomes](./mail/outcomes.md)).
- **Custom outcome addresses:** your own rules, with **Test an address** ([Advanced: email outcome addresses](./advanced/email-outcome-addresses.md)).
- **Release to real SMTP:** **Relay SMTP URL** (password masked) and **Allowed recipients**; release stays off until the list has an entry ([Release](./mail/release.md)).
- **Tag and forward rules:** rules that tag or auto-forward arriving emails, edited with the webhook rule builder.

### SMS

- **Delivery simulation:** the profile (**Instant**, **Realistic**, **Manual**), the **Failure rate**, **Strict Twilio test mode** (reject `From` numbers that are not Twilio test numbers with 21606).
- **Magic numbers:** the switch, and the reference table of Twilio's test numbers and SendMock's after-send numbers ([Delivery and test numbers](./sms/delivery-and-test-numbers.md)).
- **Custom outcome numbers:** your own rules, with **Test a number**, which says whether a rule, a magic number or the profile applies ([Advanced: SMS outcome numbers](./advanced/sms-outcome-numbers.md)).

### Payments

**Checkout:** **Merchant name** (shown on checkout pages and in the `{merchant}` label), **Default currency**, and **Automatic outcome** for new hosted checkouts: **Interactive** (wait for the checkout page), **Always succeed**, **Always decline**, or **Random** with a **Success rate**. **Test values:** every enabled method's test cards, numbers, OTP, PIN or account, with the gateways offering it.

### Notifications

**Show pop-up toasts** for new emails, SMS and failed webhook deliveries, and where they appear (top or bottom; left, center or right), with a preview. Off, the bell still counts and lists everything. Saved in this browser only.

### Opened events

**Fire opened events when I view messages:** opening an email, or scrolling an SMS into view, counts as the recipient reading it and fires `email.opened` or `sms.opened`. Choose first open only or every open.

### Chaos

Make SMTP fail on purpose: **Reject the next** N messages **With code** 421, 450, 550 or 552; **Reject recipients matching** a pattern with 550; **Latency per SMTP command**; **Drop the connection during DATA**. While any is on, the section list shows "Chaos on". SMS failures use the failure rate above. See [Advanced: chaos](./advanced/chaos.md).

### OTP patterns

**OTP patterns** are regular expressions tried in order on every new email and SMS; the first capture group of the first match is the code. Add, remove, **Restore defaults**, and **Try a message** to see which pattern matched and the code it found. See [Advanced: OTP patterns](./advanced/otp-patterns.md).

### Connection

**Connect your app:** copy-ready settings for SMTP, the email API, SMS and the HTTP catcher. Pick a **Language** (Laravel and PHP, Node.js, Python, Go, Java, Ruby, .NET, cURL) and **Where does your app run?** (this machine `127.0.0.1`, a container talking to the host `host.docker.internal`, or the same Docker Compose project `sendmock`). Edit the request headers and the email and SMS bodies; every snippet follows as you type, and a value `"{{file:invoice.pdf}}"` is read and base64-encoded the way each language does it. The same content is in [Connect your app](./connect/index.md).

### About

Version and channel, uptime, listeners (SMTP, HTTP and API, provider port), the database path and size, links to the changelog and docs, **Check GitHub Releases for updates** (off by default; SendMock never calls out unless you turn it on), and the help and feedback links.

## Customize

Settings are part of the seed file, so a team shares them: [Advanced: seed file](./advanced/seed-file.md) and [Recipe: share your setup](./recipes/share-your-setup.md). To check a whole flow on every run, write a [scenario](./advanced/scenarios.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| read and change | `sendmock settings get`, `sendmock settings set <key> <value>` | `GET`, `PATCH /api/v1/settings` | `sendmock_settings_get`, `sendmock_settings_update` |
| chaos | `sendmock chaos smtp-reject`, `... clear` | `PATCH /api/v1/settings` | `sendmock_chaos_set` |
| reset to seed | `sendmock reset --yes` | `POST /api/v1/reset` | `sendmock_reset` |
| seed file | `sendmock seed export`, `... validate`, `... apply` | `/api/v1/seed/export`, `/validate`, `/apply` | `sendmock_seed_export`, `sendmock_seed_apply` |

## Related

- [Configuration and seed file](./configuration.md)
- [Advanced](./advanced/index.md)
