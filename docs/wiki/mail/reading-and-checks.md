---
title: Reading and checks
description: Every tab of an open email, the extracted codes and links, and the quality checks.
---

> Try it in the [demo](/demo/mail). Works in your install from Phase 1 (reading) and Phase 4 (Checks).

Open any email in **Mail** to see these tabs. They answer "what exactly did my app send?" and "will it look right for the people who get it?".

## What it solves

- An email looks fine in your client but breaks on a phone or in Outlook.
- A link in the email points at `localhost`, a wrong domain or a page that does not exist.
- An attachment or inline image is missing, or the wrong file is attached.
- A header your provider or the recipient's server needs (`List-Unsubscribe`, `Reply-To`) is missing.

## The extracted panel

Above the tabs, one-time codes and links found in the email are listed, each with **Copy** and **Open**. Codes are found with the patterns in [Settings > OTP patterns](../settings.md#otp-patterns); add your own if your app's format is not found ([Advanced: OTP patterns](../advanced/otp-patterns.md)).

## The tabs

| Tab | Shows | Use it to |
| --- | --- | --- |
| **HTML** | the email in a sandboxed frame. **Desktop width**, **Tablet width** and **Mobile width** resize it; **Load remote images** fetches images from the web (off by default, so opening an email never calls out); **Screenshot** saves a PNG | check the layout at each width; attach a screenshot to a bug |
| **Text** | the plain-text part | check people without HTML get a readable email |
| **Source** | the raw message, highlighted | see exactly what your app sent, byte for byte |
| **Headers** | every header as a table, with warnings for a missing or broken `List-Unsubscribe` | check `Reply-To`, `Message-ID`, custom headers |
| **Attachments** | each file with its size and type, image thumbnails, download | check the right file went out |
| **MIME** | the tree of parts: type, encoding, size, download per part | debug inline images (`cid:`) and multipart problems |
| **Checks** | client support for the HTML and CSS used, link and image check results, the spam score (when SpamAssassin is set in [Settings > Email](../settings.md#email)), and unsubscribe header checks | fix what Outlook or Gmail will not show, broken links, spammy content |
| **Timeline** | received (with a link to the SMTP session or API request), opened, delivered, bounced, complained, released, replied, forwarded, and each webhook sent | follow everything that happened to this email |
| **Template data** | for provider API sends that used a template id: the id and the dynamic data | check the data your app passed to SendGrid or Postmark templates |

## Opened events

Opening an email in the UI counts as the recipient opening it: SendMock fires `email.opened`, which your open tracking can receive through a rule. The header shows "Opened N times" with the history. Turn this off, or fire only on the first open, in [Settings > Opened events](../settings.md#opened-events).

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| raw message | `sendmock email raw <emailId>` | `GET /api/v1/emails/{emailId}/raw` | `sendmock_email_get` |
| MIME tree | `sendmock email mime <emailId>` | `GET /api/v1/emails/{emailId}/mime` | `sendmock_email_mime` |
| checks | `sendmock email check <emailId> html` | `GET /api/v1/emails/{emailId}/html-check`, `/link-check`, `/spam-check` | `sendmock_email_check` |
| timeline | `sendmock email timeline <emailId>` | `GET /api/v1/emails/{emailId}/timeline` | `sendmock_email_timeline` |
| simulate an open | `sendmock email open <emailId>` | `POST /api/v1/emails/{emailId}/open` | `sendmock_email_open` |

## Related

- [Mail](./index.md)
- [Outcomes](./outcomes.md)
