---
title: Inbound routes in depth
description: Route replies by ticket with named groups, store and notify, use other providers' inbound formats, and let your app create routes through Mailgun's API.
---

> Works in your install from Phase 4. Try it in the [demo](/demo/webhooks/inbound-routes) today.

[Inbound routes](../webhooks/inbound-routes.md) explains the screen. This page covers the patterns apps use.

## Steps: route replies by ticket

1. In **Settings > Email**, add your reply domain to **Inbound domains**, for example `reply.app.test`.
2. In **Webhooks > Inbound routes**, press **Add route**. **Description** `Ticket replies`, **Pattern** `reply\+(?P<ticket>[\w-]+)@reply\.app\.test`.
3. The preview shows "Matches N of the last 50 incoming emails" and, for each, the captured group (`ticket = 42`). An invalid pattern shows "Not a valid regular expression".
4. The route starts with a **Forward to URL** action: set its target to `http://localhost:8000/tickets/\g<ticket>/replies`. Then **Add action** > **Stop**.
5. Press **Add route**. Replies to `reply+42@reply.app.test` now post to `/tickets/42/replies`.

## Patterns

| You want | Filter | Actions |
| --- | --- | --- |
| replies to a ticket | `match_recipient("reply\+(?P<ticket>.+)@reply.app.test")` | `forward("http://localhost:8000/tickets/\g<ticket>/replies")`, `stop()` |
| a support inbox | `match_recipient("support@.*")` | `forward("http://localhost:8000/webhooks/support")` |
| by subject | `match_header("subject", ".*invoice.*")` | `forward(...)` |
| keep everything else | `catch_all()` | `store(notify="http://localhost:8000/webhooks/stored")` |

**Store and notify** keeps the message and posts a notification with a `message-url`; your app fetches the message from it, as with Mailgun.

## Priority and stop

Lower priority numbers run first; equal priorities run oldest first. Every matching route runs until one has **Stop**, so a catch-all at the bottom collects what the others did not stop.

## Other inbound formats

Routes post Mailgun's form by default. To post SendGrid Inbound Parse or Postmark inbound instead, forward through an endpoint that uses that template; the filter and actions stay the same.

## Your app creates the routes

Apps that create their routes on boot keep working: SendMock answers Mailgun's Routes API (`GET` and `POST /v3/routes`, `GET`, `PUT` and `DELETE /v3/routes/{routeId}`) on port `8026`, and the routes appear on this screen.

## Responses your app can give

`2xx` is success; `406` rejects the message without retries; anything else is retried.

## Related

- [Inbound routes](../webhooks/inbound-routes.md)
- [Recipe: reply by email](../recipes/reply-by-email.md)
