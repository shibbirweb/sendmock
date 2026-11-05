---
name: sendmock
description: Test and debug email, SMS, payments, HTTP calls and webhooks locally with SendMock. Use it when an app sends email or SMS, takes payments, calls a webhook, or receives provider webhooks, and you need to see, check or simulate what happened.
---

# SendMock

Written for SendMock {{sendmock_version}}. SendMock catches what an app sends (email over SMTP or a provider API, SMS, payments, HTTP calls) and sends back what providers send (status callbacks, inbound messages, payment notifications), all on this machine.

## First step

1. Check it runs: the MCP tool `sendmock_status`, or `sendmock status --json`.
2. If it does not run, start it in the background with `sendmock serve`, or ask the user to start it.
3. Prefer the MCP tools. Without them, use the CLI with `--json`; every tool has a command (`sendmock help --all --json` lists them).
4. The MCP server starts with the toolsets `core`, `email`, `sms`, `verify`, `extract` and `webhooks`, enough to connect an app, read codes and links, and receive webhooks. The other workflows need another toolset: `logs` (SMTP and HTTP logs), `payments`, `http`, `scenario`, `rules`, `numbers`, `templates` (writing templates), `variables` or `admin` (seed and settings). When a tool is missing, run its CLI command instead, or ask the user to add the toolset to the server's arguments (`sendmock mcp --toolsets all`, or a list).

## Workflows

### Connect an app

1. `sendmock_integration_snippet` with the app's stack (for example `laravel`, `express`, `django`) and the channel gives the settings to change.
2. Change the app's configuration, send something from the app, then check it arrived with `sendmock_email_latest` or `sendmock_sms_wait`.
3. Nothing arrived: read `sendmock_logs_smtp` (email) or `sendmock_logs_http` (provider APIs) before changing anything else.

### Read an OTP or a link

1. Trigger the app's flow (sign up, log in, reset a password).
2. `sendmock_email_wait` or `sendmock_sms_wait` for the message to the user's address or number.
3. `sendmock_otp_get` for the code, `sendmock_links_get` for the links, then finish the flow in the app.

### Receive provider webhooks in the app

1. `sendmock_webhook_template_list` to find the provider's format (Twilio, SendGrid, Stripe, ...).
2. `sendmock_webhook_endpoint_create` with the app's local URL and that template, then `sendmock_webhook_rule_create` for the events the app needs.
3. Make the event happen (`sendmock_sms_simulate_inbound`, `sendmock_email_simulate`, a payment), then read `sendmock_webhook_delivery_list` and `sendmock_webhook_delivery_get` for what the app answered.
4. A failed delivery: read its request and response, fix the app, then `sendmock_webhook_delivery_replay`.

### Take a test payment

1. `sendmock_payment_create_checkout` on the gateway the app uses, or let the app call the gateway's own API on SendMock's provider port.
2. `sendmock_checkout_complete` pays, declines or cancels it with a test card, then `sendmock_payment_wait` for the outcome the app should see.

### add-payment-gateway

Add a gateway SendMock does not ship, from the provider's docs the user points to.

1. Read the docs: the checkout request, the redirect fields, the notification's event names, body and signature.
2. `sendmock_payment_gateway_create` from the closest built-in, then `sendmock_payment_gateway_update` with the methods it offers, the redirect fields, the event names and the notification templates.
3. When the provider's checkout steps differ from every flow, follow add-payment-flow first, and `sendmock_payment_method_create` or `sendmock_payment_method_update` for the method that runs it.
4. `sendmock_payment_gateway_preview` until it renders without problems.
5. `sendmock_payment_create_checkout` and `sendmock_checkout_complete` for a test checkout; confirm the app received the redirect and the notification.
6. `sendmock_seed_export` so the user can commit the gateway.

### add-payment-flow

Compose a checkout flow step by step, for example "wallet number, OTP, then PIN".

1. `sendmock_payment_step_type_list` for the steps SendMock can show and check.
2. `sendmock_payment_flow_create`, then `sendmock_payment_flow_step_add` for each step in order, with the provider's labels.
3. `sendmock_payment_flow_get` to check the order, attach the flow to a method with `sendmock_payment_method_update`, and run a test checkout.

### add-email-provider

Add an email API SendMock does not ship, from its API docs.

1. `sendmock_email_provider_create` from the closest built-in, or blank.
2. `sendmock_email_provider_update` with its requests, field mapping, checks and responses.
3. `sendmock_email_provider_preview` until a sample request is stored and answered as the provider answers.
4. Send a test request with `curl` or the provider's SDK, then `sendmock_seed_export`.

### add-sms-provider

The same for an SMS vendor: `sendmock_sms_provider_create`, `sendmock_sms_provider_update` (with its status names and its error code for each delivery outcome), `sendmock_sms_provider_preview`, a test request, then `sendmock_seed_export`.

### Capture outgoing HTTP calls

`sendmock_http_bin_create` with a preset (Slack, Discord, Telegram, push), point the app at the bin's URL, and `sendmock_http_wait` for the call.

### Make it repeatable

Write the steps as a scenario file (see `examples/`), check it with `sendmock_scenario_validate` and run it with `sendmock_scenario_run` or `sendmock scenario run <file>`, which exits with `5` when an `assert` fails, so it works in CI. Export the setup with `sendmock seed export` so it can be committed.

## Safety rules

- Never run `sendmock_reset` or a delete-all without the user's confirmation.
- Never print secret values; SendMock masks them, so do not try to read them back.
- Keep webhook endpoints on local URLs unless the user asks for another.
- Create new endpoints, rules and providers instead of changing ones the user made.
