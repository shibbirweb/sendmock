---
title: Provider gaps
description: Answer a vendor endpoint SendMock does not implement on the provider's own base URL, with an HTTP Catcher bin, its rules and a signed follow-up webhook.
---

Every provider SendMock emulates misses some endpoints. When your app calls one, the provider port answers `404` and your test stops. Attach an HTTP Catcher bin to the provider and the bin answers those requests instead, on the same base URL your app's SDK already uses.

## What it solves

- Your app calls a vendor endpoint SendMock does not ship, such as Twilio's `Calls.json`, and you cannot change the SDK's base URL for one call.
- The vendor calls your app back after it answers (a status callback, an event), and your handler needs that request, signed as the vendor signs it.
- You use a vendor SendMock does not ship at all: a custom provider with no operations and an attached bin serves it at the vendor's paths.

## How it works

- Built-in operations always answer first. Only a request the provider does not serve goes to the bin.
- A provider has one bin at most; a bin can serve several providers.
- The bin captures the request with the provider's name and answers with its [response rules](./responses.md), or its default reply.
- A rule can send a **follow-up webhook** after it answers: to a URL from the request (`{{ request.form.StatusCallback }}`) or to a webhook endpoint, with any webhook template and a delay. It is a webhook delivery, so it is logged, retried and replayable. Vendor templates such as `twilio.status_callback` sign it as the vendor does.
- The API request log names the bin and the rule that answered, and the bin lists the providers that send to it.
- The catch URL `/catch/<bin>/` and the catch-all port keep working as before, so one bin can serve both.

On the shared provider port SendMock finds the provider by the request's `Host`, then by the provider whose paths fit the request best, then the only provider with a bin. A request under `/providers/<key>/` or on a provider's own `--provider-port` always goes to that provider.

## Attach a bin

1. Open the provider: Mail > Providers, SMS > Providers or Payments > Gateways, then the provider's **General** tab.
2. Under **Unmatched requests**, choose a bin, or click **Create a bin for this provider**.
3. Click **Open its rules** and add a rule for the endpoint.

Push services have no sheet; attach their bins from the CLI, the API or MCP.

## Worked example: Twilio calls

Your app places calls with the Twilio SDK and waits for the call's status callback. SendMock answers Twilio's Messages API but not its Calls API.

1. Attach a bin to the Twilio provider:

```bash
sendmock http provider-bin attach sms twilio --bin-name twilio-gaps
```

2. Add a rule that answers `Calls.json` as Twilio does and calls the app back with a signed status callback a second later. Save it as `calls-rule.json`:

```json
[
  {
    "id": "",
    "name": "Calls",
    "is_enabled": true,
    "method": "POST",
    "path_glob": "/2010-04-01/Accounts/*/Calls.json",
    "filter": null,
    "response": {
      "status_code": 201,
      "headers": { "content-type": "application/json" },
      "body": "{\"sid\": \"CA{{ random_hex(32) }}\", \"status\": \"queued\", \"to\": \"{{ request.form.To }}\", \"from\": \"{{ request.form.From }}\"}"
    },
    "delay_min_ms": 0,
    "delay_max_ms": 0,
    "failure_rate_percent": 0,
    "failure_status_code": 503,
    "follow_up": {
      "url": "{{ request.form.StatusCallback }}",
      "endpoint_id": null,
      "template_id": "twilio-call-status",
      "delay_ms": 1000
    }
  }
]
```

3. Load the rule into the bin (find its ID with `sendmock http bin list`):

```bash
sendmock http response set <binId> --file calls-rule.json
```

4. Add the callback's template, a custom template named `twilio-call-status`, in Webhooks > Templates. Its body is the form Twilio sends (`CallSid={{ data.response.json.sid }}&CallStatus=completed&...`), and its `X-Twilio-Signature` header is `{{ twilio_signature(endpoint.url, body_fields, vars.twilio_auth_token) }}`, so your handler's `RequestValidator` accepts it.

5. Place a call from your app. The SDK gets the rule's `201`, and a second later your `StatusCallback` URL gets the signed callback. Check it in Webhooks > Deliveries, or:

```bash
sendmock logs http --api twilio
```

With an AI agent, the `fill-provider-gap` prompt walks through the same steps.

## In the seed file

```toml
[[http.provider_bins]]
area = "sms"
provider = "twilio"
bin = "twilio-gaps"
```

The bin itself, with its rules, is a `[[http.bins]]` item.

## From the CLI, API and AI

| Do this | CLI | API | MCP tool |
| --- | --- | --- | --- |
| list the attached bins | [`sendmock http provider-bin list`](/cli/http-catcher/#http-provider-bin-list) | [`GET /api/v1/provider-bins`](/api/http-catcher/#getProviderBins) | [`sendmock_http_provider_bin_list`](/mcp/http-catcher/#sendmock_http_provider_bin_list) |
| attach a bin to a provider | [`sendmock http provider-bin attach <area> <providerKey>`](/cli/http-catcher/#http-provider-bin-attach) | [`PUT /api/v1/provider-bins/{area}/{providerKey}`](/api/http-catcher/#putProviderBinsByAreaByProviderKey) | [`sendmock_http_provider_bin_attach`](/mcp/http-catcher/#sendmock_http_provider_bin_attach) |
| answer `404` again | [`sendmock http provider-bin detach <area> <providerKey>`](/cli/http-catcher/#http-provider-bin-detach) | [`DELETE /api/v1/provider-bins/{area}/{providerKey}`](/api/http-catcher/#deleteProviderBinsByAreaByProviderKey) | [`sendmock_http_provider_bin_detach`](/mcp/http-catcher/#sendmock_http_provider_bin_detach) |

## Related

- [Responses](./responses.md)
- [HTTP Catcher](./index.md)
- [Supported providers](../providers.md)
