---
title: Tour of the app
description: Every sidebar menu and header tool in one page, with its keyboard key and what it is for.
---

> Try it in the [demo](/demo/). The demo is the real UI with sample data.

SendMock's screen has three parts: the **sidebar** on the left (where you go), the **header** at the top (tools that work everywhere), and the **page**. Most pages are a list with a detail beside it, like a mail client; on a phone the list and detail stack.

## The sidebar

Press `G` and then the key in the table to jump to a menu from anywhere.

| Menu | Key | What it is for | Page |
| --- | --- | --- | --- |
| Overview | `G O` | the home dashboard: counts, activity, webhook health, recent failures and how to connect | [Overview](./overview.md) |
| Mail > Inbox | `G M` | every email your app sent, and the replies you simulate | [Mail](./mail/index.md) |
| Mail > Providers | | the email APIs SendMock answers (SendGrid, Mailgun, ..., your own) | [Providers](./mail/providers.md) |
| SMS > Messages | `G S` | every SMS and WhatsApp message, as conversations | [SMS](./sms/index.md) |
| SMS > Verify | `G V` | Twilio Verify codes, with their expiry and attempts | [Verify](./sms/verify.md) |
| SMS > Providers | | the SMS APIs SendMock answers (Twilio, Vonage, ..., your own) | [Providers](./sms/providers.md) |
| HTTP Catcher | `G H` | the catcher for any other HTTP call your app makes | [HTTP Catcher](./http/index.md) |
| Webhooks | `G W` | what SendMock sends back to your app, and its health | [Webhooks](./webhooks/index.md) |
| Webhooks > Endpoints | | where deliveries go and how they are shaped and signed | [Endpoints](./webhooks/endpoints.md) |
| Webhooks > Rules | | which events go to which endpoint, automatically | [Rules](./webhooks/rules.md) |
| Webhooks > Inbound routes | | where incoming email (replies) goes, like Mailgun Routes | [Inbound routes](./webhooks/inbound-routes.md) |
| Webhooks > Deliveries | `G D` | the log of everything sent, with retry and replay | [Deliveries](./webhooks/deliveries.md) |
| Webhooks > Composer | | a request written by hand, like a small Postman | [Composer and Saved](./webhooks/composer-and-saved.md) |
| Webhooks > Templates | | the shapes a request can take (Twilio, Postmark, Slack, your own) | [Templates](./webhooks/templates.md) |
| Webhooks > Variables | | values templates read: tokens, secrets, ids, random values | [Variables](./webhooks/variables.md) |
| Webhooks > Saved | | deliveries you bookmarked to send again | [Composer and Saved](./webhooks/composer-and-saved.md) |
| Payments | `G P` | every test payment, with its timeline and Simulate menu | [Payments](./payments/index.md) |
| Payments > Gateways | | the emulated providers: Stripe, PayPal, SSLCommerz, bKash, your own | [Gateways](./payments/gateways.md) |
| Payments > Methods | | what a customer pays with (card, bKash, Nagad, ...) and its test values | [Methods](./payments/methods.md) |
| Payments > Flows | | the steps a checkout page asks for (card form, number, OTP, PIN, ...) | [Flows](./payments/flows.md) |
| Numbers | `G N` | your fake phone numbers and Messaging Services, set up like a provider console | [Numbers](./numbers.md) |
| Scenarios | `G C` | multi-step tests you write once and run again, step by step | [Scenarios](./scenarios.md) |
| Logs | `G L` | the raw SMTP sessions and API requests behind every message | [Logs](./logs.md) |
| Settings | `G ,` | how SendMock behaves: outcomes, profiles, chaos, seed file, connection snippets | [Settings](./settings.md) |

The bottom of the sidebar shows whether the live connection is up and the version. `Mod+B` (`Cmd+B` on macOS, `Ctrl+B` elsewhere) hides or shows the sidebar.

## The header

- **Search** and the **command palette** (`Mod+K`): jump to any screen, or run an action, by typing its name.
- **Notification bell**: the unread count and the last 50 notable events (new email, new or inbound SMS, failed webhook deliveries), each linking to its item. Pop-up toasts can be turned off or moved in **Settings > Notifications**.
- **Help menu**: the docs, keyboard shortcuts, what's new, **Report an issue**, **Request a feature**, private security reporting and the repository.
- **Theme** (`T`): light, dark or follow the system.

## Keys that work in lists

| Key | Does |
| --- | --- |
| `J` / `K` | next / previous item |
| `Enter` | open the selected item |
| `D` | delete the open item |
| `/` | focus the search |
| `?` | show every shortcut |
| `R`, `Shift+R`, `F` | reply, reply all, forward as the recipient (Mail) |

## Empty screens

A screen with nothing yet shows what will appear there, a **how to connect** card with the exact host and ports to copy, and a sample button (**Send a sample email**, **Send a sample SMS**, **Start a sample verification**, **Add a sample number**). Samples go through the same path as real traffic, so they fire events, webhooks and notifications. A screen that is empty only because of a search or filter says so and offers **Clear filter** instead.

## The demo toolbar

The [demo](/demo/) has a **Demo controls** button that installed SendMock does not have. It changes the sample data set (including **Empty (no traffic)**), API latency and errors, live traffic, and whether SendMock pretends to run in Docker, so every state of a screen can be seen.

## Next

[How it all connects](./how-it-connects.md) explains how these menus feed each other.
