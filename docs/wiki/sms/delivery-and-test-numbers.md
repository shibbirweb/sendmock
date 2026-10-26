---
title: Delivery and test numbers
description: How SMS move from queued to delivered or failed, Twilio's official test numbers, and the status callbacks your app receives.
---

> Try it in the [demo](/demo/sms). Works in your install from Phase 2.

## What it solves

- Your app's status callback handler (sent, delivered, undelivered, failed) is never called during development.
- You need a number that always fails with a specific Twilio error, so a test can check your error handling every run.
- You want to see your app's "sending..." state, which instant delivery skips.

## How a message moves

Outbound messages move through **queued**, **sent** and **delivered**, or end **undelivered** or **failed** with an error code. Each change:

1. is added to the message's status history (in **Message details**);
2. calls the message's status callback (`StatusCallback` on Twilio, or `status_callback` on the native API) in the provider's format, logged as a delivery;
3. fires `sms.status` for your [rules](../webhooks/rules.md).

How fast, and whether it fails, is set in [Settings > SMS](../settings.md#sms):

| Profile | Does |
| --- | --- |
| Instant (default) | delivered at once |
| Realistic | queued, sent after about 300 ms, delivered after 1 to 3 s |
| Manual | stays sent until you press **Set status** in Message details |

A **failure rate** (0 to 100%) marks a random share of messages undelivered or failed.

## Twilio's test numbers

SendMock's magic numbers are Twilio's official test numbers, with the same error codes, returned at once as an HTTP 400 with Twilio's error JSON. Tests written against SendMock match Twilio's own test mode.

`To` numbers:

| To | Result | Twilio error |
| --- | --- | --- |
| `+15005550001` | invalid number | 21211 |
| `+15005550002` | cannot route to this number | 21612 |
| `+15005550003` | no international permissions | 21408 |
| `+15005550004` | number is blocked (opted out) | 21610 |
| `+15005550009` | number cannot receive SMS | 21614 |

`From` numbers:

| From | Result | Twilio error |
| --- | --- | --- |
| `+15005550001` | invalid From | 21212 |
| `+15005550006` | valid, passes | |
| `+15005550007` | not owned or not SMS-capable | 21606 |
| `+15005550008` | message queue full | 21611 |

Any other `From` is accepted. Turn on **Strict Twilio test mode** to reject them with 21606, as real test credentials do.

## SendMock's after-send numbers

Twilio's test mode never sends status callbacks, so SendMock adds numbers that are accepted and then change status:

| To | Result | Code in the callback |
| --- | --- | --- |
| `+15005550101` | undelivered (unreachable handset) | 30003 |
| `+15005550102` | undelivered (landline or unreachable carrier) | 30006 |
| `+15005550103` | undelivered (filtered by the carrier) | 30007 |
| `+15005550104` | failed (unknown error) | 30008 |
| `+15005550105` | delivered after 30 s | |
| `+15005550106` | delivered, then read (WhatsApp style) | |

Vonage sends map the same outcomes to Vonage's own codes and status names. Turn all magic numbers off with **Magic numbers** in Settings; they then behave like any number.

## Your own numbers

Rules such as "my QA number always fails with 30007" or "every `+1555777*` number is delivered after 10 s" are [Advanced: SMS outcome numbers](../advanced/sms-outcome-numbers.md). Order: your rules first, then the magic numbers, then the profile and failure rate. **Test a number** in Settings shows which one applies.

Step by step: [Recipe: failed SMS](../recipes/failed-sms.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| set a status by hand | [`sendmock sms status <smsId> <status>`](/cli/sms/#sms-status) | [`POST /api/v1/sms/{smsId}/status`](/api/sms/#postSmsBySmsIdStatus) | [`sendmock_sms_set_status`](/mcp/sms/#sendmock_sms_set_status) |
| profile and failure rate | [`sendmock settings set`](/cli/system/#settings-set) | [`PATCH /api/v1/settings`](/api/system/#patchSettings) | [`sendmock_settings_update`](/mcp/system/#sendmock_settings_update) |
| list own outcome numbers | [`sendmock outcome-rule sms list`](/cli/outcome-rules/#outcome-rule-sms-list) | [`GET /api/v1/outcome-rules/sms`](/api/outcome-rules/#getOutcomeRulesSms) | [`sendmock_outcome_rule_list`](/mcp/outcome-rules/#sendmock_outcome_rule_list) |
| add one | [`sendmock outcome-rule sms create`](/cli/outcome-rules/#outcome-rule-sms-create) | [`POST /api/v1/outcome-rules/sms`](/api/outcome-rules/#postOutcomeRulesSms) | [`sendmock_outcome_rule_create`](/mcp/outcome-rules/#sendmock_outcome_rule_create) |
| test a number | [`sendmock outcome-rule sms test <number>`](/cli/outcome-rules/#outcome-rule-sms-test) | [`POST /api/v1/outcome-rules/sms/test`](/api/outcome-rules/#postOutcomeRulesSmsTest) | [`sendmock_outcome_rule_test`](/mcp/outcome-rules/#sendmock_outcome_rule_test) |

## Related

- [SMS](./index.md)
- [Settings > SMS](../settings.md#sms)
