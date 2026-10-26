---
title: Rules and filters
description: Exact filters for webhook rules. Groups, not, headers, regex, multi-value fields, and how several rules fire.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/webhooks/rules) today.

A rule's filter decides which events reach its endpoint. The builder covers simple cases in one row and complex ones with groups.

## Building blocks

- **Condition:** field, operator, value, and a **not** toggle.
- **Group:** "Match **all** of these" or "Match **any** of these". **Add group** adds one nested group (the API accepts deeper nesting); **Negate nested group** wraps it in `not`.
- **No conditions** means every selected event fires.

## Fields

| Events | Fields |
| --- | --- |
| `email.*` | From, To, Cc, Subject, Body, Header (asks for the header name), Has attachment, Tag |
| `sms.*` | From, To, Body, Status, API |
| `email.opened`, `sms.opened` | Open count, First open, Source |

With email and SMS events both ticked, both sets show; a condition on a field the event does not have never matches.

## Operators

| Operator | Matches | Case |
| --- | --- | --- |
| equals | the whole value | ignored |
| contains | part of the value | ignored |
| starts with | the start | ignored |
| matches | a glob, `*@support.local` | ignored |
| regex | a JavaScript-style regular expression | sensitive |
| exists | any non-empty value (no value needed) | |

Fields with several values (To, Cc, Tag) match when **any** value matches.

## Examples

| You want | Filter |
| --- | --- |
| support tickets | all: To matches `*@support.local`, Subject contains `Ticket` |
| bounces except test domains | all: not (To matches `*@example.test`) |
| VIP tickets that are not spam | all: Subject contains `Ticket`; group not (any: Tag equals `spam`) |
| mail with a tenant header | all: Header `X-Tenant` exists |
| SMS that failed with a carrier error | all: Status equals undelivered |

## Check before saving

The preview says "Matches N of the last 50 messages" and lists them, with **Show non-matching**. Problems show as you type: "Enter a value", "Invalid regex", "Enter the header name".

## How several rules fire

Every enabled rule whose events and filter match creates its own delivery, in list order. Rules do not stop each other, so one email can reach your app and a Slack alert. To send something only once, make the filters exclusive (with **not**).

## In the API

```json
{
  "endpoint_id": "01JB...",
  "events": ["email.received"],
  "filter": {
    "all": [
      { "field": "to", "operator": "matches", "value": "*@support.local" },
      { "field": "subject", "operator": "contains", "value": "Ticket" }
    ]
  }
}
```

## Related

- [Rules](../webhooks/rules.md)
- [Inbound routes](./inbound-routes.md)
