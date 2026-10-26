---
title: Catcher responses
description: Make an HTTP Catcher bin answer like a real API, or like a failing one. Rules by path, templated bodies, delays and failure rates.
---

> Works in your install from Phase 4. Try it in the [demo](/demo/http) today.

Each bin answers every request with its default reply, unless a response rule matches first. Rules let one bin behave like a whole API: success here, a rate limit there, an occasional 500, a slow endpoint.

## When you would

- Your app's retry and backoff code should run: answer 429 or 500 some of the time.
- Your app should time out gracefully: delay the answer past its timeout.
- Your app needs an id back: echo a generated id in the body.

## Steps: a rate-limited push API

1. Open **HTTP Catcher**, click the `push` bin, and open the **Responses** tab.
2. Press **Add rule**. **Name** `Quota exceeded`, **Path** `/v1/*`, **Status code** `429`, **Failure rate (%)** `10`.
3. The preview runs against the bin's latest request: "This rule answers this request." Change **Path** to `/v2/*` and it says why not ("Path ... does not match /v2/*").
4. Press **Add rule**. The rule shows as "Any method /v1/*: 429, 10% fail with 500".
5. Move it with **Move Quota exceeded up**, switch it off without deleting, or delete it.
6. **Edit default reply** changes what the bin answers when nothing matches; press **Save reply**.

## What a rule can do

| Part | Options |
| --- | --- |
| Match | method (any or one), a path glob relative to the bin, header and body conditions (the webhook rule builder) |
| Answer | status code, headers and body as templates |
| Delay | fixed, or a random range in milliseconds, up to 30 s |
| Failure rate | 0 to 100%, with the status code a failure returns |

## Templated bodies

The body can use the request:

```json
{
  "id": "{{ uuid() }}",
  "received": {{ request.json.text | tojson }},
  "path": "{{ request.path }}"
}
```

Available: `request.method`, `request.path`, `request.query`, `request.headers`, `request.body`, `request.json`, `vars`, and the template functions and filters.

## Examples

| You want | Rule |
| --- | --- |
| Slack's real answer | preset Slack incoming webhook (default `200 ok`) |
| an expired push token | match body `message.token` equals `expired-token-1`: `404` with FCM's `UNREGISTERED` error |
| a slow partner API | path `/orders/*`: delay 2,000 to 6,000 ms |
| flaky everything | no match conditions: `200`, failure rate 20% with `503` |

## In the seed file

Bins are exported with their preset; rules go with them.

```toml
[[http.bins]]
name = "push"
preset = "fcm"
```

## With the CLI

```bash
sendmock http response set --bin push --status 429 --body '{"error": "quota exceeded"}'
```

## Related

- [Responses](../http/responses.md)
- [Recipe: Slack and push](../recipes/slack-and-push.md)
