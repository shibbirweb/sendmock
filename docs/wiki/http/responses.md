---
title: Responses
description: Choose how a bin answers, with a default reply and rules by method and path with templated bodies, delays and failure rates.
---

> Try it in the [demo](/demo/http). Works in your install from Phase 4.

Each bin answers every request. The answer decides what your app sees: success, a rate limit, a server error, or a slow reply that hits your timeout.

## What it solves

- Your app's retry and backoff code never runs, because the real API rarely fails.
- Your app needs a realistic answer (a message id, an `ok: true`) to carry on.
- You want to know what happens when a partner API takes 5 seconds.

## How a bin chooses its answer

1. The **rules** are checked from the top; the **first match wins**.
2. With no match, the **Default reply** is sent (the preset's reply, or `200 {"ok":true}`).
3. A rule with a **failure rate** answers with its failure status that share of the time ("Simulated failure").

The **Response** tab of each captured request says which one answered.

## The Responses tab

Open a bin and the **Responses** tab:

- Rules in order, with move up and down, an enabled switch, a summary such as "POST /v1/* when header x-env is test: 429 after 0.5 to 2 s, 10% fail with 500", and edit and delete.
- **Default reply** with **Edit default reply**.
- **Add rule** opens the rule sheet.

## The rule sheet

| Part | What to set |
| --- | --- |
| Name | what the rule is for, for example "Quota exceeded" |
| Match | the method (any or one), a **Path** glob relative to the bin (`/v1/*`), and header or body conditions with the same builder as webhook rules |
| Response | **Status code**, headers and body, written as templates |
| Delay | fixed, or a random range in milliseconds (up to 30 s) |
| Failure rate | 0 to 100%, with the status code a failure returns |
| Preview | against a captured request of the bin: whether this rule matches it (and why not), and the rendered status, headers and body |

Templates can read the request: `request.method`, `request.path`, `request.query`, `request.headers`, `request.body`, `request.json`, plus `vars` and the template functions, for example:

```json
{ "id": "{{ uuid() }}", "received": {{ request.json.text | tojson }} }
```

Step by step, with examples: [Advanced: catcher responses](../advanced/catcher-responses.md).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| set a reply | `sendmock http response set --bin push --status 429` | `/api/v1/http/bins/{binId}/responses` | `sendmock_http_response_set` |
| preview a rule | | `POST /api/v1/http/bins/{binId}/responses/preview` | |

## Related

- [HTTP catcher](./index.md)
- [Variables](../webhooks/variables.md)
