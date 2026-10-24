# 12. Webhook Variables and Templating

Webhook requests should not be fixed blobs. Users need to mix static values (API keys, tenant IDs), data from the event (recipient, subject, OTP), generated values (UUIDs, random numbers, fake names), and text transformations (lowercase, truncate, hash) anywhere in the request. This page defines that system.

## Where variables can be used

Every part of a webhook request is a template:

| Part | Example |
|------|---------|
| URL and path | `{{ vars.base_url }}/hooks/{{ event.type }}` |
| Query params | `?ref={{ uuid() }}&to={{ data.to[0].address \| urlencode }}` |
| Headers | `Authorization: Bearer {{ vars.api_token }}` |
| Body (any mode) | JSON, form fields, multipart, XML, plain text |
| Signing secret | `{{ vars.signing_secret }}` |

The same engine is used by automatic rules, manual sends, replays (when re-rendering) and the request composer.

## Engine

`minijinja` (Jinja2 syntax, already in the stack). It is sandboxed (no file, network or env access), fast, and supports filters, functions, conditionals and loops:

```jinja
{% if data.extracted.otp %}OTP: {{ data.extracted.otp | first }}{% else %}No code{% endif %}
```

Safety limits: a fuel/instruction budget per render, a maximum output size (default 1 MB) and a render timeout, so a bad template cannot hang the dispatcher.

## Variable kinds

All user-defined variables are managed in one place (UI: **Webhooks > Variables**) and read in templates as `{{ vars.<name> }}`. Each variable has a name, kind, optional description, and a scope.

| Kind | What it is | Example |
|------|------------|---------|
| **Text** | static string | `tenant_id = acme` |
| **Number** | static number, emitted unquoted in Fields mode | `priority = 5` |
| **Boolean** | `true` / `false` | `sandbox = true` |
| **JSON** | static object or array | `meta = {"env":"local"}` |
| **Secret** | static string, masked in UI, API responses and delivery logs | `api_token = sk_live_...` |
| **Dynamic** | a path or expression evaluated against the current event | `recipient = data.to[0].address \| lower` |
| **Random** | a generator evaluated per send (or once, see below) | `nonce = random_string(16)` |
| **Computed** | a template combining other variables | `full_ref = "{{ vars.tenant_id }}-{{ vars.nonce }}"` |
| **Prompt** (manual) | asked for when sending manually; default value used for automatic sends | `reason` (default `"manual test"`) |

### Scopes and precedence

Highest wins:

1. **Send-time overrides:** values typed into the manual send dialog, or passed in the API call (`"variables": { ... }`).
2. **Endpoint variables:** defined on one endpoint.
3. **Global variables:** shared by all endpoints.
4. **Environment variables:** `MSS_VAR_<NAME>` from the process env, exposed as `vars.<name>` (lowercased). Only this prefix is read, so other secrets in the environment are never reachable. Useful for CI.

### Random value stability

Each Random variable has a mode:

- **Per send (default):** regenerated every delivery attempt group. Retries of the same delivery reuse the same values so the receiver sees a consistent payload (important for idempotency keys).
- **Fixed:** generated once when saved; a "Regenerate" button refreshes it.

Replay offers two choices: **Replay as-is** (reuse the stored rendered request) or **Re-render** (evaluate templates again with fresh random values and current variable values).

## Built-in dynamic context

Available in every template without defining anything:

| Name | Contents |
|------|----------|
| `event.id`, `event.type`, `event.created_at` | event envelope |
| `data` | the event's data object, same shape as the native webhook payload ([05-webhooks.md](05-webhooks.md)) |
| `data.extracted.otp`, `data.extracted.links` | extractor output (email and SMS) |
| `email` / `sms` | alias of `data` when the event is about that type (handy in conditionals) |
| `endpoint.name`, `endpoint.url` | the target endpoint |
| `delivery.id`, `delivery.attempt`, `delivery.trigger` | `auto`, `manual`, `replay` |
| `rule.id`, `rule.name` | the rule that fired (null for manual) |
| `mss.version`, `mss.http_url` | instance info, e.g. to build attachment links |
| `request_id` | a ULID unique to this delivery, stable across retries |

## Built-in functions (random and generated values)

| Function | Output |
|----------|--------|
| `uuid()` | UUID v4 |
| `uuid7()` | UUID v7 (time ordered) |
| `ulid()` | ULID |
| `now()` | current time (use with the `date` filter) |
| `timestamp()` / `timestamp_ms()` | Unix seconds / milliseconds |
| `random_int(min, max)` | integer in range |
| `random_float(min, max, decimals=2)` | float |
| `random_bool()` | `true` / `false` |
| `random_string(len, charset="alnum")` | charset: `alnum`, `alpha`, `numeric`, `hex`, `upper`, `lower` |
| `random_hex(len)` | hex string |
| `random_otp(digits=6)` | numeric code |
| `random_choice(list)` | one item from a list |
| `random_phone(country="US")` | E.164 phone number |
| `fake.name()`, `fake.first_name()`, `fake.last_name()` | fake person data |
| `fake.email()`, `fake.username()`, `fake.company()` | |
| `fake.sentence()`, `fake.paragraph()`, `fake.word()` | lorem text |
| `fake.address()`, `fake.city()`, `fake.country_code()` | |
| `fake.ip()`, `fake.user_agent()`, `fake.url()` | |
| `lorem(words)` | placeholder text of N words |

Fake data uses the `fake` crate with an optional locale setting (e.g. `en`, `bn` where available).

### Postman-style aliases

For people coming from Postman, `{{$randomUUID}}`, `{{$timestamp}}`, `{{$randomInt}}`, `{{$guid}}`, `{{$randomEmail}}`, `{{$randomFirstName}}` and similar are rewritten to the equivalent functions before rendering. The editor's autocomplete lists both forms.

## Text filters

Applied with `|`, chainable: `{{ data.subject | trim | lower | truncate(40) }}`.

| Group | Filters |
|-------|---------|
| Case and whitespace | `upper`, `lower`, `title`, `capitalize`, `trim`, `squish` (collapse whitespace) |
| Length and slicing | `truncate(n, end="...")`, `length`, `first`, `last`, `slice(start, end)` |
| Replace and match | `replace(from, to)`, `regex_replace(pattern, to)`, `regex_extract(pattern, group=0)`, `contains(text)` |
| Defaults | `default(value)`, `required` (fails the render with a clear error if empty) |
| Formatting | `slugify`, `pad_left(n, ch)`, `pad_right(n, ch)`, `number_format(decimals)` |
| Encoding | `urlencode`, `base64_encode`, `base64_decode`, `hex_encode`, `escape_html`, `strip_html` |
| JSON | `tojson` (safe JSON string), `fromjson`, `pick("a","b")`, `omit("x")` |
| Hashing and signing | `md5`, `sha1`, `sha256`, `sha512`, `hmac_sha256(key)`, `hmac_sha1(key)` |
| Dates | `date(format="%Y-%m-%dT%H:%M:%SZ", tz="UTC")`, `date_add(seconds)`, `unix` |
| Lists | `join(sep)`, `map(attribute="address")`, `unique`, `sort` |
| Phone | `e164`, `phone_country`, `phone_national` |

Custom signature schemes can be built entirely from filters, e.g. a header:

```
X-Signature: {{ (timestamp() ~ "." ~ body) | hmac_sha256(vars.signing_secret) }}
```

`body` is available in header and query templates and holds the already rendered body, so the signature covers exactly what is sent.

## Body modes

The endpoint editor and manual composer offer:

| Mode | Use |
|------|-----|
| **Template** | a built-in service template (Twilio, SendGrid, Slack, ...) or a saved custom template ([13-webhook-templates.md](13-webhook-templates.md)), plus an optional "Extra fields" table merged in, each value a template |
| **Fields** | key/value rows; each value is a template with a type (text, number, boolean, JSON, file for multipart). Encoded as JSON, `x-www-form-urlencoded` or `multipart/form-data`. `mss` handles quoting and escaping, so users cannot produce invalid JSON. Nested keys via dot notation (`user.email`). |
| **Raw** | free-text template with a content type (JSON, XML, plain text, HTML, custom). JSON raw bodies are validated after rendering and show a warning if invalid. |
| **None** | no body (for GET or pure ping requests) |

Fields mode is the recommended default for most users; Raw is for full control.

### Example: Raw JSON template

```jinja
{
  "event": "{{ event.type }}",
  "recipient": {{ data.to[0].address | lower | tojson }},
  "subject": {{ data.subject | truncate(50) | tojson }},
  "otp": {{ data.extracted.otp | first | default("") | tojson }},
  "tenant": {{ vars.tenant_id | tojson }},
  "nonce": "{{ random_string(12) }}",
  "customer": { "name": {{ fake.name() | tojson }}, "id": {{ random_int(1000, 9999) }} },
  "sent_at": "{{ now() | date }}"
}
```

### Example: Fields mode

| Key | Type | Value |
|-----|------|-------|
| `event` | text | `{{ event.type }}` |
| `to` | text | `{{ data.to[0].address }}` |
| `attempt` | number | `{{ delivery.attempt }}` |
| `is_otp` | boolean | `{{ data.extracted.otp \| length > 0 }}` |
| `ref` | text | `{{ vars.tenant_id }}-{{ uuid() }}` |
| `meta` | JSON | `{{ vars.meta \| tojson }}` |

## Editor experience (UI)

- CodeMirror 6 editor (lazy loaded) with Jinja + JSON highlighting.
- Autocomplete on `{{`: variables (with kind badge), event fields for the selected event type, functions and filters with signatures.
- Hover a variable to see its current value (secrets masked).
- **Live preview panel:** pick a sample (latest email, latest SMS, a specific message, or a built-in fixture) and see the fully rendered URL, headers and body update as you type.
- Inline errors with line/column for syntax errors and undefined variables.
- "Insert" menu for common snippets: random UUID, timestamp, OTP, recipient, HMAC signature header.
- Manual send dialog shows a form for every **Prompt** variable plus an "Override variables" section.

## Error handling

- **Strict mode (default):** an undefined variable or a `required` failure stops the delivery. It is logged as `render_failed` with the error message and is not sent. Retrying does not help, so it is not retried automatically.
- **Lenient mode (per endpoint):** undefined values render as empty strings and a warning is attached to the delivery log.

## Storage and logs

- `webhook_variables` table: id, scope (`global` or `endpoint`), endpoint_id (nullable), name, kind, value (JSON: static value, expression, or generator config), is_secret, mode (`per_send`/`fixed`), description, created_at, updated_at. Unique on (scope, endpoint_id, name).
- `webhook_endpoints` gains: url_template, query (JSON list of key/template), headers (templates), body_mode, body_content_type, body_template / body_fields (JSON), render_mode (`strict`/`lenient`).
- Each delivery stores the **rendered** request with secret values replaced by `••••••` for display, plus the resolved variable snapshot (secrets masked). Replay as-is re-injects secrets from their current values.
- Secrets are never returned in plain text by the API after creation (write-only, with a "reveal" action in the UI that requires confirmation).

## API additions

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PATCH/DELETE | `/webhooks/variables` | manage global and endpoint variables (`?endpoint_id=`) |
| POST | `/webhooks/variables/{variableId}/regenerate` | refresh a Fixed random variable |
| POST | `/webhooks/render` | render a template or endpoint against a sample (`email_id`, `sms_id`, or inline data) without sending; returns URL, headers, body, warnings |
| GET | `/webhooks/template-reference` | list of functions, filters and context fields (drives autocomplete and docs) |

`POST /webhooks/endpoints/{endpointId}/send` and `/webhooks/deliveries/{deliveryId}/replay` accept `"variables": { "name": "value" }` overrides and `"rerender": true|false`.
