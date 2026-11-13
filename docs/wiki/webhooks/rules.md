---
title: Rules
description: Send matching events to an endpoint automatically, with a visual filter and a preview against recent messages.
---

> Try it in the [demo](/demo/webhooks/rules).

A rule says "when these events happen, and they match this filter, send them to this endpoint". Rules are what make webhooks automatic.

![The Rules screen](../images/webhook-rules.jpg)

## What it solves

- Only some messages should reach a handler: mail to `support@`, SMS to one number, bounces only.
- One event should reach several handlers (your app and a Slack alert).
- You want to know which messages a filter catches before saving it.

## How it connects

| Gets from | Sends to |
| --- | --- |
| events from every capture menu ([Events](./index.md#events)) | the rule's [endpoint](./endpoints.md), as a delivery in [Deliveries](./deliveries.md) |

## Use it

1. Press **Add rule** and give it a name, for example "Support inbox to Laravel".
2. Pick the endpoint and tick the events, for example `email.received`.
3. Press **Add condition**: field **To**, operator **matches**, value `*@support.local`.
4. Watch the preview: "Matches N of the last 50 messages", with the matching ones listed.
5. Press **Add rule**. The next matching email creates a delivery.

## Everything on this screen

### The list

Rules in firing order with move up and down, name, endpoint, event chips, a plain-language filter ("to matches \*@support.local and subject contains Ticket"), an enabled switch that applies at once, and edit and delete. Disabled rules are dimmed. An endpoint filter at the top narrows the list (also from `?endpoint=`).

### The rule sheet

- **Name**, **endpoint**, and **events** as checkboxes grouped by area (Email, SMS, Verify, HTTP, Webhooks).
- **Filter builder:** a group says "Match **all** / **any** of these"; each row is field, operator and value, with a **not** toggle. **Add condition** adds a row, **Add group** one nested group. No conditions means every selected event fires.
- **Fields** follow the events: email fields (from, to, cc, subject, body, header, has attachment, tag) for `email.*`, SMS fields (from, to, body, status, API) for `sms.*`, open fields (open count, first open, source) for opened events. A condition on a field the event does not have never matches.
- **Operators:** equals, contains, starts with, matches (glob, like `*@support.local`), regex, exists. All but regex ignore case.
- Problems show as you type: a missing value, an invalid regex, a missing header name.
- **Preview:** "Matches N of the last 50 messages", the messages listed with matches marked, and **Show non-matching**. Events without filter fields (Verify, HTTP, Webhooks) skip the preview.

### How rules fire

Every enabled rule is checked, top to bottom, and **each matching rule creates its own delivery**. Order matters for reading the list and for the delivery order, not for stopping: a message can match several rules.


Every control and text, one by one: [Rules in depth](../deeper/webhooks/rules.md).
### On every simulation

Every action that simulates traffic names the webhooks its event will trigger before you run it, so you never have to guess which rules match:

- **Mail:** each item of the **Simulate** menu (open, click, delivered, bounces, complaint, unsubscribe), the **Reply**, **Reply all** and **Forward** composers, and **Import .eml** stored as incoming.
- **SMS:** **Simulate read** in a message's menu, **Set status** in the message details, and **Reply as recipient**.
- **Payments:** each item of a payment's **Simulate** menu.
- **Send a sample** buttons on empty screens.

Composers show a **Webhooks** row above their buttons; menu items show the names under their label, or **No webhook**. Each name opens the endpoint in a new tab, so the form or menu stays as it was.

To send one action somewhere else without changing any rule:

1. Press **Change** in a composer, or **Choose** beside a menu item.
2. Tick the endpoints that should get it. The rule matches start ticked; untick them all to send no webhook.
3. Press **Use these** (a composer then sends to them) or the action's own button (a menu item runs at once).

Each chosen endpoint gets one delivery with its own template and secret, marked `chosen` in [Deliveries](./deliveries.md). The choice is for that one action only; the link in the picker opens this screen filtered to the event, to change it for every event of that type. An SMS number's own callback URLs and a payment gateway's notification endpoint still get their requests, and traffic your app sends over SMTP or a provider API always follows the rules.

## Customize

Grouped filters, `not`, header fields and regex: [Advanced: rules and filters](../advanced/rules-and-filters.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| list | [`sendmock webhook rule list`](/cli/webhook-rules/#webhook-rule-list) | [`GET /api/v1/webhooks/rules`](/api/webhook-rules/#getWebhooksRules) | [`sendmock_webhook_rule_list`](/mcp/webhook-rules/#sendmock_webhook_rule_list) |
| one rule | [`sendmock webhook rule show <ruleId>`](/cli/webhook-rules/#webhook-rule-show) | [`GET /api/v1/webhooks/rules/{ruleId}`](/api/webhook-rules/#getWebhooksRulesByRuleId) | [`sendmock_webhook_rule_get`](/mcp/webhook-rules/#sendmock_webhook_rule_get) |
| create | [`sendmock webhook rule create`](/cli/webhook-rules/#webhook-rule-create) | [`POST /api/v1/webhooks/rules`](/api/webhook-rules/#postWebhooksRules) | [`sendmock_webhook_rule_create`](/mcp/webhook-rules/#sendmock_webhook_rule_create) |
| update | [`sendmock webhook rule update <ruleId>`](/cli/webhook-rules/#webhook-rule-update) | [`PATCH /api/v1/webhooks/rules/{ruleId}`](/api/webhook-rules/#patchWebhooksRulesByRuleId) | [`sendmock_webhook_rule_update`](/mcp/webhook-rules/#sendmock_webhook_rule_update) |
| move | [`sendmock webhook rule move <ruleId>`](/cli/webhook-rules/#webhook-rule-move) | [`POST /api/v1/webhooks/rules/{ruleId}/move`](/api/webhook-rules/#postWebhooksRulesByRuleIdMove) | [`sendmock_webhook_rule_move`](/mcp/webhook-rules/#sendmock_webhook_rule_move) |
| preview a filter | [`sendmock webhook rule preview`](/cli/webhook-rules/#webhook-rule-preview) | [`POST /api/v1/webhooks/rules/preview`](/api/webhook-rules/#postWebhooksRulesPreview) | [`sendmock_webhook_rule_preview`](/mcp/webhook-rules/#sendmock_webhook_rule_preview) |
| which webhooks an event would trigger | [`sendmock webhook rule match`](/cli/webhook-rules/#webhook-rule-match) | [`POST /api/v1/webhooks/rules/match`](/api/webhook-rules/#postWebhooksRulesMatch) | [`sendmock_webhook_rule_match`](/mcp/webhook-rules/#sendmock_webhook_rule_match) |

The simulating commands and tools take `--webhook <endpointId>` (repeat it for several) or `webhook_endpoint_ids` to send that one action to exactly those endpoints, for example `sendmock email simulate <emailId> bounced --webhook <endpointId>`.

## Related

- [Endpoints](./endpoints.md)
- [Inbound routes](./inbound-routes.md) (rules for incoming email)
