---
title: Coming from Mailpit
description: Switch from Mailpit to SendMock without changing your app or the tests that read mail through Mailpit's API.
---

SendMock listens on Mailpit's ports and answers Mailpit's API paths, so an app and a test suite set up for Mailpit work against SendMock unchanged.

## What keeps working

- **Ports:** SMTP on `1025` and the web UI and API on `8025`, as Mailpit uses.
- **Tags from headers:** an `X-Tags` header tags the message, as in Mailpit.
- **Mailpit's API:** these paths answer with Mailpit's JSON shapes, checked against Mailpit's own API definition (v1.33):

| Path | What it does |
|------|--------------|
| `GET /api/v1/messages?start=0&limit=50` | Lists messages, newest first, with `total`, `unread`, `messages_count`, `messages_unread` and `tags` |
| `GET /api/v1/search?query=...` | Lists messages matching a search, with the same counts |
| `DELETE /api/v1/search?query=...` | Deletes the messages matching a search |
| `PUT /api/v1/messages` | Marks messages read or unread: by `IDs`, by `Search`, or every message |
| `DELETE /api/v1/messages` | Deletes the messages in `IDs`, or every message when the body is empty |
| `GET /api/v1/message/{ID}` | One message, with `Text`, `HTML`, `Attachments` and `Inline` parts; marks it read |
| `GET /api/v1/message/{ID}/headers` | The headers, in alphabetical order |
| `GET /api/v1/message/{ID}/raw` | The message source |
| `GET /api/v1/message/{ID}/part/{PartID}` | An attachment or inline part, by the `PartID` the message lists |
| `GET /api/v1/tags`, `PUT /api/v1/tags` | Every tag; replaces the tags of the messages in `IDs` |
| `GET /view/{ID}.html`, `GET /view/{ID}.txt` | The HTML or text part alone, for UI tests; 404 when the message has none |

`{ID}` can be `latest` for the newest message. Searches read Mailpit's `from:`, `to:`, `subject:`, `tag:`, `is:read`, `is:unread` and `has:attachment` filters, and plain words.

For example, a test that reads the latest email's text:

```bash
curl http://127.0.0.1:8025/api/v1/message/latest
```

## What differs

- **`GET /api/v1/info` and `POST /api/v1/send`** are SendMock's own endpoints at the same paths, with SendMock's shapes ([REST API](../reference/index.md)). An app that sends mail over SMTP, as most do, is not affected.
- **Tags** are stored in lower case.
- **Message IDs** are SendMock's IDs; use them as Mailpit's (read them from a list, pass them back).
- **Not emulated:** Mailpit's chaos settings, web UI configuration, HTML, link and spam checks, release, thumbnails, and renaming or deleting a tag. SendMock has its own [SMTP chaos](../settings.md#chaos), [HTML, link and spam checks](reading-and-checks.md) and [release](release.md).

## What SendMock adds

SMS and Verify, payments, webhooks with signing and retries, an HTTP catcher, provider API emulation (SendGrid, Mailgun, Postmark, Resend, SES, Brevo, Twilio and more), an MCP server for AI agents, and a CLI for every action. Start with the [overview](../overview.md).
