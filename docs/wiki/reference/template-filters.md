---
title: Template filters
description: Every filter you can use in webhook templates, provider definitions and gateway templates.
---

> Generated from SendMock's code, so it always matches the binary.

Templates use Jinja syntax: `{{ data.subject | truncate(20) }}` passes the value through a filter, and filters chain from left to right. See [Templates](../advanced/templates.md) and [Variables](../advanced/variables.md) for what a template can read.

## SendMock's filters

| Filter | Usage | What it gives |
| --- | --- | --- |
| `default` | `value \| default(fallback)` | The fallback when the value is missing, null or empty. |
| `d` | `value \| d(fallback)` | Short for `default`. |
| `required` | `value \| required(message)` | Stops the render with the message when the value is missing, null or empty. |
| `capitalize` | `text \| capitalize` | The first character in upper case and the rest in lower case. |
| `squish` | `text \| squish` | Every run of whitespace collapsed into one space, with the ends trimmed. |
| `truncate` | `text \| truncate(length, end="...")` | The first `length` characters, followed by `end` when the text was cut. |
| `slice` | `value \| slice(start, end)` | Characters or list items from `start` up to `end` (excluded); negative indexes count from the end. |
| `regex_replace` | `text \| regex_replace(pattern, replacement)` | Every match of the regular expression replaced; `$1` or `${name}` in the replacement inserts a capture. |
| `regex_extract` | `text \| regex_extract(pattern, group)` | The match of the regular expression, or its capture `group`; empty when nothing matches. |
| `contains` | `value \| contains(item)` | Whether a text contains a piece of text, or a list contains an item. |
| `slugify` | `text \| slugify` | Lowercase ASCII words joined by `-`: `Hello, World!` becomes `hello-world`. |
| `pad_left` | `text \| pad_left(width, character)` | The text padded on the left to `width` characters, with spaces or the given character. |
| `pad_right` | `text \| pad_right(width, character)` | The text padded on the right to `width` characters, with spaces or the given character. |
| `number_format` | `number \| number_format(decimals)` | The number with `decimals` places and `,` between thousands: `1234.5` becomes `1,234.50`. |
| `date` | `time \| date(format, tz="UTC")` | The time written with a `strftime` format (default `%Y-%m-%dT%H:%M:%SZ`) in a time zone (default UTC). |
| `date_add` | `time \| date_add(seconds)` | The time `seconds` later, or earlier when negative, as an RFC 3339 timestamp. |
| `unix` | `time \| unix` | The time as Unix seconds. |
| `e164` | `phone \| e164` | The number without spaces, dashes, dots or brackets, a leading `00` turned into `+`. |
| `phone_country` | `phone \| phone_country` | The ISO country code of an international number, or an empty string. |
| `phone_national` | `phone \| phone_national` | The digits after the calling code, or every digit when the country is unknown. |
| `urlencode` | `value \| urlencode` | Percent-encoded as JavaScript's `encodeURIComponent` does. |
| `base64_encode` | `value \| base64_encode` | The text encoded as standard Base64. |
| `base64_decode` | `text \| base64_decode` | Standard Base64 decoded back to text. |
| `hex_encode` | `value \| hex_encode` | The text's bytes as lowercase hexadecimal. |
| `escape_html` | `value \| escape_html` | `&`, `<`, `>`, `"` and `'` escaped for HTML. |
| `strip_html` | `value \| strip_html` | The text with HTML tags removed. |
| `json` | `value \| json` | The value as indented JSON, written as it is even inside a JSON string. |
| `tojson` | `value \| tojson` | The value as compact JSON (a string gets its quotes), written as it is. |
| `fromjson` | `text \| fromjson` | JSON text parsed into a value, so its fields can be read. |
| `pick` | `object \| pick("key", ...)` | The object with only the named keys. |
| `omit` | `object \| omit("key", ...)` | The object without the named keys. |
| `md5` | `value \| md5` | The MD5 digest as lowercase hexadecimal. |
| `sha1` | `value \| sha1` | The SHA-1 digest as lowercase hexadecimal. |
| `sha256` | `value \| sha256` | The SHA-256 digest as lowercase hexadecimal. |
| `sha512` | `value \| sha512` | The SHA-512 digest as lowercase hexadecimal. |
| `hmac_sha256` | `value \| hmac_sha256(key, encoding="hex")` | The HMAC-SHA256 of the value with the key, as `hex` (default) or `base64`, for provider signatures. |
| `hmac_sha1` | `value \| hmac_sha1(key, encoding="hex")` | The HMAC-SHA1 of the value with the key, as `hex` (default) or `base64`. |
| `sendgrid_event` | `event.type \| sendgrid_event` | SendGrid's name for an email event, such as `bounce` for `email.bounced`. |
| `ses_type` | `event.type \| ses_type` | Amazon SES's notification type for an email event, such as `Bounce`. |
| `resend_type` | `event.type \| resend_type` | Resend's event type for an email event, such as `email.bounced`. |
| `mailgun_event` | `event.type \| mailgun_event` | Mailgun's event name for an email event, such as `failed`. |
| `postmark_record_type` | `event.type \| postmark_record_type` | Postmark's record type for an email event, such as `Bounce`. |
| `brevo_event` | `event.type \| brevo_event` | Brevo's event name for an email event, such as `hard_bounce`. |
| `payment_event` | `event.type \| payment_event("stripe")` | The payment provider's name for a payment event, or the native name when it has none. |

## Jinja's built-in filters

These come from the template engine, [minijinja](https://docs.rs/minijinja/latest/minijinja/filters/index.html), and work as they do in Jinja: `upper`, `lower`, `title`, `trim`, `length`, `count`, `first`, `last`, `replace`, `join`, `map`, `unique`, `sort`, `reverse`, `round`, `abs`, `int`, `float`, `string`, `list`, `items`, `dictsort`, `select`, `reject`, `selectattr`, `rejectattr`, `sum`, `min`, `max`, `split`, `lines`, `indent`, `attr`, `groupby`, `chain`, `zip`, `format`, `bool`, `escape`, `e`, `safe`, `batch`.
