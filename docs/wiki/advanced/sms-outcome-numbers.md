---
title: SMS outcome numbers
description: Your own numbers and patterns that are rejected, fail after sending, arrive late or are read.
---

> Works in your install from Phase 2. Try it in the [demo](/demo/settings?section=sms) today.

Twilio's test numbers cover the standard errors. Your own rules cover your QA numbers: "this one always fails with 30007", "every `+1555777*` number is delivered after 10 seconds".

## When you would

- Your test phone numbers should fail in a known way, every run.
- You want to see your app's "still sending" state with a slow delivery.
- You test read receipts on WhatsApp.

## Steps

1. Open **Settings > SMS**, find **Custom outcome numbers** and press **Add number**.
2. **Number is the** To or From number; **Number or pattern** an exact E.164 number or a pattern with `*` (`+1555777*`).
3. **Outcome:** Reject on send (HTTP 400 with Twilio's error JSON), Accepted then undelivered, Accepted then failed, Delivered after a delay, or Delivered then read.
4. The dialog asks only for what the outcome needs: an **Error code** (for example `30007`) or a **Delay (seconds)** (1 to 3,600). Add a **Note (optional)** and press **Add rule**.
5. Type a number in **Test a number**: it says which applies, for example "Custom rule 1: Accepted, then undelivered, 30007".

## How rules are applied

Your rules first (in order, first match wins), then the magic numbers (unless switched off), then the simulation profile and failure rate. Rows move up and down, switch off and delete.

## In the seed file

```toml
[[sms.outcome_rules]]
match = "to"
pattern = "+15559990000"
outcome = "undelivered"
error_code = 30007
note = "QA phone"
enabled = true
```

## With the CLI and API

`sendmock outcome-rule sms create` and `sendmock outcome-rule sms test <number>`, or `POST /api/v1/outcome-rules/sms`; MCP `sendmock_outcome_rule_create` and `sendmock_outcome_rule_test`.

## Related

- [Delivery and test numbers](../sms/delivery-and-test-numbers.md)
- [Recipe: failed SMS](../recipes/failed-sms.md)
