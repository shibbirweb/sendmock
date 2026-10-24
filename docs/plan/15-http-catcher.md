# 15. HTTP Catcher (Request Bin)

Apps send more than email and SMS: Slack/Discord/Teams notifications, push notifications (FCM, APNs, OneSignal, Expo), Telegram bot messages, analytics pings, third-party webhooks. The HTTP catcher captures **any HTTP request** your app makes to MessageHook, shows it in the UI, and answers with a configurable mock response, so the app keeps working locally without hitting real services.

This turns MessageHook into a sandbox for all outbound communication, not only email and SMS (MockPost and Webhook.site offer similar capture).

## Behaviour

- **Catch-all path:** anything under `http://127.0.0.1:8025/catch/<bin>/...` is captured. `<bin>` is a free-form name (e.g. `slack`, `push`, `analytics`) that groups requests; bins are created on first use.
- **Optional catch-all port:** `--catcher-addr 127.0.0.1:8030` captures every request on that port at any path (bin = first path segment or `default`), for apps where only the host can be changed.
- **Everything recorded:** method, full URL, query, headers, body (raw, plus pretty JSON/form/multipart parsing; files saved like attachments), client IP, timing. Bodies capped at 1 MB by default.
- Publishes `http.captured` on the event bus, so webhook rules, the realtime UI, CLI tail and MCP all see it.

## Mock responses

Each bin has response rules evaluated in order (first match wins), with a default of `200 {"ok":true}`:

| Field | Notes |
|-------|-------|
| Match | method, path glob, header/body filters (same filter builder as webhook rules) |
| Status | any code, e.g. `200`, `201`, `429`, `500` |
| Headers | templated (variables and filters from [12-webhook-variables.md](12-webhook-variables.md)) |
| Body | templated, can echo request data: `{"id": "{{ uuid() }}", "received": {{ request.json.text \| tojson }}}` |
| Delay | fixed or random range, to test timeouts |
| Failure rate | random fraction answered with a chosen error, to test retries |

## Presets

Ready-made bins whose mock responses mimic the real service, so SDKs do not choke on the reply:

| Preset | Captures | Mock reply |
|--------|----------|-----------|
| Slack incoming webhook | `POST` with `text` / `blocks` | `200 ok` (plain text, as Slack returns) |
| Discord webhook | embeds, content | `204` (or message JSON with `?wait=true`) |
| Microsoft Teams / Google Chat | card payloads | `200` |
| Telegram Bot API | `/bot<token>/sendMessage` etc. | `{"ok":true,"result":{...}}` |
| Firebase Cloud Messaging v1 | `/v1/projects/{p}/messages:send` | `{"name":"projects/.../messages/<id>"}` |
| Expo push | `/--/api/v2/push/send` | tickets with `status: ok` |
| OneSignal | `/notifications` | `{ "id": ..., "recipients": 1 }` |
| Generic JSON API | anything | echo with generated `id` |

The UI renders recognised payloads nicely: Slack Block Kit and Discord embeds as message previews, push notifications as a phone notification card.

## UI

**HTTP** section in the sidebar: bins list with counts, request list (method, path, status returned, time), request detail (headers, body pretty/raw, query, response sent), "Copy as cURL", "Forward to URL" (resend the captured request to a real or local URL), "Send to webhook", and the response rule editor with live preview.

## API, CLI, MCP

- API: `/api/v1/http/bins`, `/api/v1/http/requests`, `/api/v1/http/bins/{binId}/responses`, `/api/v1/wait/http?bin=slack&timeout=10s`.
- CLI: `messagehook http bins|list|show|tail|forward`, `messagehook http response set ...`.
- MCP: `messagehook_http_list`, `messagehook_http_get`, `messagehook_http_wait`, `messagehook_http_response_set` (toolset `http`).

## Storage

`http_bins` (name, preset, response rules JSON) and `http_requests` (bin_id, method, url, headers, body blob, parsed JSON, response_status, response_body, duration_ms, created_at). Same retention settings as messages.

## Roadmap placement

UI built on mock data in Phase U2. Backend in Phase 4 (catch path, bins, mock responses, Slack/Discord/Telegram/FCM presets); remaining presets and the dedicated catch-all port in Phase 5.
