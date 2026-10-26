---
title: Outcomes
description: Simulate delivered, deferred, bounced, complained and unsubscribed, by hand or with magic addresses, and send them to your app.
---

> Try it in the [demo](/demo/mail). Works in your install from Phase 3 (native events) and Phase 4 (provider formats).

Real email providers tell your app what happened after sending: the email was delivered, bounced, marked as spam, or the person unsubscribed. Your app usually reacts (stop mailing a dead address, show "email bounced" to an admin). SendMock creates those outcomes on demand.

## What it solves

- Your suppression list or "email bounced" banner has never been tested, because real bounces are hard to produce.
- You parse SendGrid, Mailgun, Postmark or SES event webhooks and need realistic payloads.
- Your tests need an address that always bounces, every run.

## The outcomes

| Event | Means |
| --- | --- |
| `email.delivered` | the provider delivered it to the mailbox |
| `email.deferred` | a temporary failure; the provider will retry (a soft bounce in progress) |
| `email.bounced` | a hard bounce (`550 5.1.1 user unknown`) or a soft bounce after retries, with the SMTP code and text |
| `email.complained` | the recipient marked it as spam |
| `email.unsubscribed` | the recipient used the `List-Unsubscribe` one-click link |

## Four ways to trigger them

1. **By hand:** open an email and press **Simulate**, then **Delivered**, **Hard bounce**, **Soft bounce**, **Spam complaint** or **Unsubscribe**.
2. **Magic addresses:** send to one of these and the outcome happens by itself. They follow the Amazon SES mailbox simulator, plus short aliases that work on any domain:

   | Recipient | Outcome |
   | --- | --- |
   | `success@simulator.amazonses.com`, `delivered@<any domain>` | delivered |
   | `bounce@simulator.amazonses.com`, `bounce@<any domain>`, `bounce+hard@<any domain>` | hard bounce |
   | `bounce+soft@<any domain>` | deferred, then a soft bounce |
   | `complaint@simulator.amazonses.com`, `complaint@<any domain>` | delivered, then a complaint |
   | `ooto@simulator.amazonses.com` | delivered, then an out-of-office reply arrives as a new email |
   | `suppressionlist@simulator.amazonses.com` | bounce with a suppression-list reason |

   Turn them off with **Magic addresses** in [Settings > Email](../settings.md#email).
3. **Your own addresses:** rules such as "`*@bounce.qa.test` always hard bounces" or "reject `*@blocked.test` with 550". See [Advanced: email outcome addresses](../advanced/email-outcome-addresses.md).
4. **The delivery profile** in [Settings > Email](../settings.md#email): off (no outcome events), auto-delivered (every email gets `email.delivered`), or realistic (a delay plus a bounce and complaint rate).

## Getting them to your app

Outcomes are events, so they go wherever your [rules](../webhooks/rules.md) send them. Pick the endpoint's template to match your provider: SendGrid Event Webhook, Mailgun events, Postmark Bounce, SpamComplaint and Delivery, SES via SNS, Resend, or SendMock's native JSON. Each outcome also shows on the email (a badge and a **Timeline** entry).

Step by step: [Recipe: bounces and complaints](../recipes/bounces-and-complaints.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| simulate | `sendmock email simulate <emailId> <event>` | [`POST /api/v1/emails/{emailId}/simulate`](/api/email/#postEmailsByEmailIdSimulate) | `sendmock_email_simulate` |
| list own outcome addresses | `sendmock outcome-rule email list` | [`GET /api/v1/outcome-rules/email`](/api/outcome-rules/#getOutcomeRulesEmail) | `sendmock_outcome_rule_list` |
| add one | `sendmock outcome-rule email create` | [`POST /api/v1/outcome-rules/email`](/api/outcome-rules/#postOutcomeRulesEmail) | `sendmock_outcome_rule_create` |
| test an address | `sendmock outcome-rule email test <address>` | [`POST /api/v1/outcome-rules/email/test`](/api/outcome-rules/#postOutcomeRulesEmailTest) | `sendmock_outcome_rule_test` |

## Related

- [Mail](./index.md)
- [Settings > Email](../settings.md#email)
