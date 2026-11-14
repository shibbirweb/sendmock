---
title: Magic numbers and addresses
description: The test phone numbers and email addresses that make SendMock simulate a delivery outcome.
---

> Generated from SendMock's code, so it always matches the binary.

Send to one of these and SendMock answers as the real service would for that outcome, with no setup. They are on by default and can be turned off in Settings; your own rules are described in [Custom outcome numbers](../advanced/sms-outcome-numbers.md) and [Custom outcome addresses](../advanced/email-outcome-addresses.md).

## SMS magic numbers

The Twilio numbers and error codes are Twilio's official test numbers, so the same tests pass against Twilio's test credentials. A `whatsapp:` prefix is ignored.

### Twilio's test numbers as the recipient (`To`), refused when the message is sent

| Number | What happens | Error code |
| --- | --- | --- |
| `+15005550001` | Invalid number | `21211` |
| `+15005550002` | Cannot route to this number | `21612` |
| `+15005550003` | No international permissions | `21408` |
| `+15005550004` | Number is blocked (opted out) | `21610` |
| `+15005550009` | Number cannot receive SMS | `21614` |

### SendMock's numbers as the recipient (`To`), accepted and then changed by a status callback

| Number | What happens | Error code |
| --- | --- | --- |
| `+15005550101` | Accepted, then undelivered (unreachable handset) | `30003` |
| `+15005550102` | Accepted, then undelivered (landline or unreachable carrier) | `30006` |
| `+15005550103` | Accepted, then undelivered (filtered by carrier) | `30007` |
| `+15005550104` | Accepted, then failed (unknown error) | `30008` |
| `+15005550105` | Accepted, delivered after 30 s |  |
| `+15005550106` | Accepted, delivered, then read |  |

### Twilio's test numbers as the sender (`From`)

| Number | What happens | Error code |
| --- | --- | --- |
| `+15005550001` | Invalid From | `21212` |
| `+15005550006` | Valid, passes |  |
| `+15005550007` | Not owned or not SMS-capable | `21606` |
| `+15005550008` | Message queue full | `21611` |

## Email magic addresses

Addresses compare without case. The Amazon SES mailbox simulator addresses work only on their own domain.

| Address | What happens |
| --- | --- |
| `delivered@<any domain>` | email.delivered |
| `bounce@<any domain>` | Hard bounce (550 5.1.1) |
| `bounce+hard@<any domain>` | Hard bounce (550 5.1.1) |
| `bounce+soft@<any domain>` | email.deferred, then soft bounce |
| `complaint@<any domain>` | Delivered, then email.complained |
| `success@simulator.amazonses.com` | email.delivered |
| `bounce@simulator.amazonses.com` | Hard bounce (550 5.1.1) |
| `complaint@simulator.amazonses.com` | Delivered, then email.complained |
| `ooto@simulator.amazonses.com` | Delivered, then an out-of-office reply |
| `suppressionlist@simulator.amazonses.com` | Bounce with a suppression-list reason |
