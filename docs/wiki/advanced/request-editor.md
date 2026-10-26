---
title: Request editor
description: Write a webhook request by hand. Body modes, query and headers, Strict or Lenient rendering, the code editor and the live preview.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/webhooks/endpoints) today.

The request editor is the endpoint sheet's **Request** tab; the Composer and the template editor use the same one. It decides exactly what an endpoint sends.

## Body mode

| Mode | Use when | You write |
| --- | --- | --- |
| **Template** | a template fits | pick it, choose Linked or Detached, and add extra body fields on top |
| **Fields** | your app expects JSON or a form with known fields | rows of name, type (Text, Number, Boolean or JSON) and a template value; encoded as JSON or Form, so the body is always valid |
| **Raw** | the body has an unusual shape (XML, nested JSON, text) | a content type and the body in the code editor |
| **None** | a GET or a ping without a body | nothing |

**Query params** and **headers** are name and template rows in every mode.

## Rendering

- **Strict** (default): an undefined value stops the delivery as `render failed`, so a typo never sends a half-empty request.
- **Lenient:** an undefined value renders empty, with a warning.

## The code editor

`{{ }}` is highlighted, JSON bodies are highlighted, typing `{{` suggests values, hovering a value shows its example (secrets masked), and the **Insert** menu adds the common ones: Event type, Recipient, Subject, OTP code, Random id, Timestamp.

## The live preview

Pick the sample or a recent email or SMS, and see the rendered method and URL, headers and body as you type. Problems show under the part they come from (the URL, a query param, a header, a field, the body), and in the editor they are underlined at their line.

## Example: a Raw JSON body

```json
{
  "id": "{{ request_id }}",
  "to": "{{ data.to[0].address | lower }}",
  "subject": {{ data.subject | tojson }},
  "code": "{{ data.extracted.otp[0] | default('') }}",
  "tenant": "{{ vars.tenant_id }}"
}
```

## What templates can read

`event` (id, type, time), `data` (the message, shaped by the event), `vars`, `endpoint`, `delivery`, `rule`, `request_id`, functions (`uuid()`, `now()`, `timestamp()`, `random_string(16)`, `random_otp()`, `fake.name()`, ...) and filters (`lower`, `truncate`, `default`, `urlencode`, `base64_encode`, `tojson`, `sha256`, `hmac_sha256(key)`, `date`, ...). The reference panel beside every field lists them with examples.

## Custom signatures

Build any signature from filters. `body` holds the rendered body in header templates:

```
X-Signature: {{ (timestamp() ~ "." ~ body) | hmac_sha256(vars.signing_secret) }}
```

## Related

- [Endpoints](../webhooks/endpoints.md)
- [Templates](./templates.md)
- [Variables](./variables.md)
