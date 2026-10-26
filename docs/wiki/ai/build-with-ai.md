---
title: Build it with AI
description: Prompts that work for everything you can create in SendMock, what the agent does with each, and how to check the result.
---

> Works with the MCP tools and CLI as each backend phase lands; the built-in prompts and skill arrive in Phase 4. See [AI](./index.md) to set up.

Everything on the [Advanced](../advanced/index.md) pages, an agent can do from one sentence. It uses the same operations as the UI, so the same checks apply: an invalid flow, a template with errors or a card number outside the test ranges is refused the same way, and the agent fixes it.

## Prompts that work

| Say | The agent | Uses |
| --- | --- | --- |
| "Add the Upay gateway. Docs: `<url>`" | reads the docs; creates the flow if needed, the method and the gateway; previews the redirect and notification; runs a test checkout; exports the seed file | `add-payment-gateway` prompt, `sendmock_payment_*` tools |
| "Add Upay as a wallet method with test number 01600000001" | creates the method on the Wallet flow with those test values | `sendmock_payment_method_create` |
| "Make a QR wallet flow" | lists the step types, adds a QR step with labels, checks the flow is valid, attaches it to a method | `add-payment-flow` prompt, `sendmock_payment_flow_step_*` tools |
| "Add Mailjet as an email provider. Docs: `<url>`" | reads the docs; adds the provider from blank; maps the sender, recipients, subject and bodies; writes the success and error answers; checks the preview; exports the seed file | `add-email-provider` prompt, `sendmock_email_provider_create`, `sendmock_email_provider_update` and `sendmock_email_provider_preview` |
| "Remove the SMS providers we do not use" | lists the SMS providers and removes the built-ins you name; they can be restored any time | `sendmock_sms_provider_list`, `sendmock_sms_provider_delete` |
| "SSLCommerz should call the success event VALIDATED" | edits the built-in gateway's event name and checks the preview | `sendmock_payment_gateway_update`, `_preview` |
| "Send Africa's Talking inbound SMS to my app" | clones the closest SMS template, changes the fields to Africa's Talking's, previews it against a sample | `sendmock_webhook_template_*` |
| "Post every email to support@ to my app in Postmark format" | creates the endpoint with the Postmark template and a rule with that filter, sends a test | `setup-inbound-webhook` prompt, endpoint and rule tools |
| "Route reply+ticket emails to /tickets/:id/replies" | creates an inbound route with a named group, previews it against recent emails | inbound route tools |
| "Make the Slack bin answer 429 one time in ten" | adds a response rule with a failure rate | `sendmock_http_response_set` |
| "Make qa+fail@ bounce and +1555777 numbers fail with 30007" | creates email and SMS outcome rules, checks them with the tester | outcome rule tools |
| "Tag every email with Invoice in the subject as billing" | creates a tag rule with that filter and checks it against recent mail | `sendmock_tag_rule_create` |
| "Write a scenario for the checkout and run it" | writes the TOML steps, validates and runs it, and saves the file | `sendmock_scenario_validate`, `sendmock_scenario_run` |
| "Add a Login Verify service with the fixed code 123456" | creates the Verify service | `sendmock_verify_service_create` |
| "Why did my webhook fail?" | reads the delivery, explains the error, suggests a fix, replays after you fix it | `debug-failed-webhook` prompt |
| "Test my OTP login" | triggers your app, waits for the SMS, reads the code, finishes the login, writes a scenario | `test-otp-flow` prompt, `sendmock_otp_get` |

## Writing a good prompt

- **Point at the source.** Link the provider's API docs, or paste a sample request (an IPN, an inbound webhook). The agent maps fields from them; it should not guess.
- **Name what is different.** "Like bKash, but the PIN comes before the OTP" or "signed with HMAC-SHA256 of the body in `X-Upay-Signature`".
- **Ask for proof.** "Run a test checkout and show me the redirect and the notification", "send a test and show the delivery".
- **Ask to keep it.** "Export the seed file when done" or "write a scenario for this".

## Checking what the agent did

1. Look in the UI: new endpoints, rules and definitions carry a badge showing they were made by an agent.
2. Open the preview (gateway Redirect and Notification, template preview, rule preview) and read the request your app will get.
3. Run it once yourself: a test checkout, **Send test** on the endpoint, a sample email.
4. Change what is wrong in the UI, or tell the agent ("the amount field should be in minor units").

## Related

- [Create a gateway with AI](./payment-gateway-with-ai.md)
- [Built-in prompts](./prompts.md)
- [Advanced](../advanced/index.md)
