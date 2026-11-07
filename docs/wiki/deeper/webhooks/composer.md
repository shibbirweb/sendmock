---
title: Composer in depth
description: Every control and text of Webhooks > Composer.
---

> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.

Webhooks > Composer writes a webhook request by hand, or from any template, and sends it to an endpoint.

The screen as a whole: [Composer and saved deliveries](../../webhooks/composer-and-saved.md).

## On the screen

### 1. Composer

Heading.

- **What it does:** Names the screen, in the header and above the form.

### 2. Read the Composer guide

Link.

- **What it does:** Opens this screen's page in the user guide, in a new tab.
- **Links to:** [Composer and saved deliveries](../../webhooks/composer-and-saved.md).

### 3. Composer

Heading.

- **What it does:** Names the screen, in the header and above the form.

### 4. Write a webhook request by hand, start from any template, and send it to an endpoint.

Text.

- **What it does:** Explains the screen.

### 5. Send to

Drop-down.

- **What it does:** The endpoint the request goes to.
- **Links to:** [Endpoints](../../webhooks/endpoints.md).

### 6. Its secret signs the request.

Text.

- **What it does:** Explains that the endpoint's secret signs it.

### 7. Preset

Drop-down.

- **What it does:** A template to start from: it fills the method, headers and body, which you can then change.

### 8. A template fills the method, headers and body, ready to edit.

Text.

- **What it does:** Explains Preset.

### 9. Method

Drop-down.

- **What it does:** The HTTP method.

### 10. URL

Field.

- **What it does:** A URL for this request only; it may hold `{{ }}` templates.

### 11. Leave empty to use the endpoint's URL.

Text.

- **What it does:** Explains the URL field.

### 12. None. Added to the URL, URL-encoded.

Text.

- **What it does:** The query parameters; none yet.

### 13. Add query param

Button.

- **What it does:** Adds a query parameter.

### 14. None besides Content-Type and the signature headers.

Text.

- **What it does:** The extra headers; none yet.

### 15. Add header

Button.

- **What it does:** Adds a header.

### 16. Template

Choice.

- **What it does:** The body comes from a webhook template.

### 17. Fields

Choice.

- **What it does:** The body is built from name and value fields.

### 18. Raw

Choice.

- **What it does:** The body is text you write, with templates inside.

### 19. None

Choice.

- **What it does:** No body.

### 20. Content type

Drop-down.

- **What it does:** The raw body's `Content-Type`.

### 21. Insert

Button.

- **What it does:** Inserts a value, function or filter at the cursor, from the template reference.

### 22. Raw body

Field.

- **What it does:** The body, in the template language.

### 23. Type \{\{ to see what you can use; hover a value to see an example.

Text.

- **What it does:** Explains the template suggestions.
- **Links to:** [Template filters](../../reference/template-filters.md).

### 24. Strict An undefined value stops the delivery as render failed.

Choice.

- **What it does:** A value that is not defined stops the send.

### 25. Lenient An undefined value renders empty, with a warning.

Choice.

- **What it does:** A value that is not defined renders empty.

### 26. vars.reason

Field.

- **What it does:** A variable the template asks for on manual sends (here `reason`).
- **Links to:** [Variables](../../webhooks/variables.md).

### 27. Asked for on manual sends.

Text.

- **What it does:** Explains why the variable is asked for.

### 28. None. A value here wins over the endpoint and global value of that name, for this send only.

Text.

- **What it does:** The variable overrides for this send; none yet.

### 29. Add override

Button.

- **What it does:** Adds a variable value for this send only.

### 30. Preview with

Drop-down.

- **What it does:** The event the preview renders with: a sample, or a recent real message.
- **Same action elsewhere:** REST [`POST /api/v1/webhooks/endpoints/preview`](/api/webhook-endpoints/#postWebhooksEndpointsPreview), CLI [`sendmock webhook render`](/cli/webhook-endpoints/#webhook-render), MCP [`sendmock_webhook_render`](/mcp/webhook-endpoints/#sendmock_webhook_render)

### 31. Copy rendered URL

Button.

- **What it does:** Copies the URL as rendered.

### 32. Rendered headers

Heading.

- **What it does:** The headers the request will carry, signature included.

### 33. Rendered body

Heading.

- **What it does:** The body the request will carry.

### 34. Copy rendered body

Button.

- **What it does:** Copies the rendered body.

### 35. Send

Button.

- **What it does:** Sends the request now and shows the delivery it made, which you can then save.
- **What it changes:** Records a manual delivery in Webhooks > Deliveries.
- **Errors:** A template that does not render is refused with the reason.
- **Same action elsewhere:** REST [`POST /api/v1/webhooks/endpoints/{endpointId}/send`](/api/webhook-endpoints/#postWebhooksEndpointsByEndpointIdSend), CLI [`sendmock webhook send`](/cli/webhook-endpoints/#webhook-send), MCP [`sendmock_webhook_send`](/mcp/webhook-endpoints/#sendmock_webhook_send)

## When the data cannot load

### 36. Could not load the endpoints to send to. Try again

Message.

- **What it does:** Shown when the endpoints could not be loaded.
- **Errors:** Check SendMock is running, then press Try again.

### 37. Could not load the endpoints to send to.

Text.

- **What it does:** The message inside the alert.

### 38. Try again

Button.

- **What it does:** Loads the endpoints again.
- **Same action elsewhere:** REST [`GET /api/v1/webhooks/endpoints`](/api/webhook-endpoints/#getWebhooksEndpoints), CLI [`sendmock webhook endpoint list`](/cli/webhook-endpoints/#webhook-endpoint-list), MCP [`sendmock_webhook_endpoint_list`](/mcp/webhook-endpoints/#sendmock_webhook_endpoint_list)
