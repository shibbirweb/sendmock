---
title: Chaos
description: Make the mail server reject, slow down or drop connections on purpose, and make SMS fail at a rate, to test your app's error handling.
---

> Works in your install from Phase 4. Try it in the [demo](/demo/settings?section=chaos) today.

Real mail servers have bad days: they reject with "try again later", they are slow, they drop the connection mid-message. Chaos makes SendMock do the same, so you can see your mailer retry (or not).

## When you would

- Your queue worker should retry a `421` and give up on a `550`.
- Your app should not hang when SMTP is slow.
- Your SMS code should cope when a share of messages fail.

## SMTP chaos

In **Settings > Chaos**:

| Option | Does |
| --- | --- |
| **Reject the next** N messages **With code** | the next N messages are refused with 421, 450, 550 or 552 |
| **Reject recipients matching** | recipients matching a pattern are refused with 550 |
| **Latency per SMTP command** | every command waits that long before the answer |
| **Drop the connection during DATA** | the client sees the connection close mid-message; nothing is stored |

Press **Save changes**. While any option is on, the Settings list shows **Chaos on**, so you do not forget. Each refused or dropped session shows in **Logs > SMTP** with its reason.

## SMS failures

Set the **Failure rate** in **Settings > SMS**: that share of messages ends undelivered or failed. For exact numbers and codes, use [SMS outcome numbers](./sms-outcome-numbers.md).

## Other services

- Webhook handlers: answer with errors on purpose, or watch retries in [Deliveries](../webhooks/deliveries.md).
- Third-party APIs: a failure rate on a catcher bin ([Catcher responses](./catcher-responses.md)).

## With the CLI

`sendmock chaos smtp-reject`, `sendmock chaos smtp-latency`, `sendmock chaos sms-failure-rate` and `sendmock chaos clear` set the same options (`sendmock chaos --help` lists their arguments); agents use the `sendmock_chaos_set` MCP tool.

## Related

- [Settings > Chaos](../settings.md#chaos)
- [Logs](../logs.md)
