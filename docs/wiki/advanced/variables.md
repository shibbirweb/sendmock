---
title: Variables in depth
description: Dynamic, Random, Computed and Prompt variables, secrets, scopes, and overrides at send time.
---

> Works in your install from Phase 3. Try it in the [demo](/demo/webhooks/variables) today.

[Variables](../webhooks/variables.md) explains the kinds. This page shows when each one earns its place.

## Dynamic: a value from the message

Pull something out of the event with a path or expression, with the same suggestions as templates:

- `data.to[0].address | lower`: the first recipient, lowercased.
- `data.from | regex_extract("@(.+)$", 1)`: the sender's domain.

The sheet shows what it **resolves to** against the sample, and refuses to save a broken expression.

## Random: a new value per send, or one fixed value

- **Per send:** `random_string(16)` for a nonce, `uuid()` for an idempotency key; each delivery gets a new one.
- **Fixed:** generated once and kept, until you press **Regenerate**. Use it for a value that must stay the same across sends, such as a fake account id.

**Replay** sends the stored request (the same values); **Re-render with fresh values** makes new ones.

## Computed: built from other variables

`{{ vars.tenant_id }}-{{ vars.nonce }}` combines two variables. Useful for a reference your app expects in one field.

## Prompt: asked for at send time

A Prompt variable has a default. Automatic sends use the default; **Send to webhook** and the Composer ask for it. Use it for "which customer id should this test use?".

## Secrets

Use **Secret** for tokens and keys a signature needs. After saving, the value is never shown again; editing with the field empty keeps it. Secrets are masked in the UI, API answers, logs and MCP output, and exported to the seed file as `${ENV_VAR}` references. When an endpoint asks for a missing variable named like a token, secret, key or password, it is stored as a secret.

## Scope and overrides

1. A **send-time override** (in Send to webhook or the Composer) wins for that one send.
2. Otherwise the **endpoint's** variable of that name.
3. Otherwise the **global** one.

So one template can serve several endpoints: put the shared value globally and the differing one on each endpoint.

## Steps: a per-endpoint tenant id

1. Press **Add variable**: name `tenant_id`, scope **Global**, kind **Text**, value `default-tenant`.
2. Press **Add variable** again: name `tenant_id`, scope your endpoint, value `acme`.
3. In the endpoint's template, use `{{ vars.tenant_id }}`. That endpoint sends `acme`; every other sends `default-tenant`.

## With the CLI

```bash
sendmock webhook var set tenant_id acme --endpoint "Laravel inbound mail"
sendmock webhook var set twilio_auth_token "$TWILIO_AUTH_TOKEN" --secret
sendmock webhook var regenerate account_id
```

## Related

- [Variables](../webhooks/variables.md)
- [Request editor](./request-editor.md)
