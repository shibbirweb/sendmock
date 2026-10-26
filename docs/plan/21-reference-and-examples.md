# 21. CLI and MCP Reference, Field Docs and Code Examples

[20-surface-parity.md](20-surface-parity.md) made every operation reachable four ways and named the CLI command and MCP tool for each. The names are all a reader gets, though:

- **CLI:** the user guide and the API reference show `sendmock email update <emailId>`, but not which flags it takes (`--read`? `--tag`?), their types, allowed values or an example.
- **MCP:** `sendmock_email_update` is named, but not the arguments an agent passes, the result, or whether the tool is read only or destructive.
- **Fields have no descriptions.** Of the 1,228 fields in the spec's schemas, none has a description, and none of the 86 request bodies has an example. The API reference shows a field's name and type only, and the playground has nothing to show.
- **Playground:** picking an operation shows the path and query fields and an empty or `{}` body. The example body only fills required fields (`PATCH /emails/{emailId}` has none, so it starts empty), and the space beside the form is blank, so a reader cannot see which fields exist, which values are allowed or what they do.
- **Docs are descriptive only.** Recipes and menu pages say what to do and show a CLI line, but not the code a developer writes in their app or test. Laravel's docs are the model readers asked for: each idea next to a short, real code example.

This plan adds a CLI reference and an MCP reference generated from the contract, documents every input field once so all four ways show the same text, makes the playground show every accepted input, and adds code examples in every supported language.

Features: **WS-07 CLI and MCP reference** and **WS-08 Code examples** ([criteria](acceptance/07-distribution-website.md#ws-07-cli-and-mcp-reference)), and three new playground criteria under **WS-04** (WS-04.4 to WS-04.6). Built as **U3 W15** on `docs/user-guide-plan`.

## 1. Document every input once

The descriptions live on the TypeScript API types (`web/src/lib/api/types`), the source the spec is generated from, so the API reference, the playground, the CLI reference and the MCP reference all show the same words.

```ts
export type EmailUpdate = {
  /**
   * Mark the email as read (true) or unread (false).
   * @example true
   */
  is_read?: boolean;
  /**
   * Replaces the email's tags. Send an empty list to remove all tags.
   * @example ["signup", "qa"]
   */
  tags?: string[];
};
```

- **Scope:** every field of every request body type (and the types they nest), every query parameter (they already have a description in the registry; they gain an example) and every path parameter. Response fields are documented where the type is shared with a request; the rest stay as they are for now.
- `generate-schemas.ts` switches ts-json-schema-generator from `jsDoc: "basic"` to `"extended"`, so `@example` becomes `examples` in the spec (JSON5 values, as the generator expects). Defaults (`@default`) are written the same way where a field has one.
- **Check (WS-07.1):** a contract test (`web/tests/contract/openapi-input-docs.test.ts`) walks every operation's inputs in the spec and fails on an input without a description, or a body field without an example. A field whose type has fields of its own takes its example from them, a one-value discriminator (`kind: "stop"`) needs none, and a map such as a gateway's `event_names` is documented by one whole-object example. `bun run openapi:check` keeps the spec in step.
- Path parameters are documented once by name in `web/src/lib/api/endpoint-registry/path-parameters.ts`; the build fails on a path parameter missing there. Query parameters carry a required `example` in the registry.
- Requirement IDs in the type comments (`(WH-05.6)`) stay in the source for traceability and are removed from the published descriptions.

## 2. One rule set for CLI flags and MCP inputs

The CLI and MCP inputs are derived from the operation's inputs by fixed rules, written into [14-ai-integration.md](14-ai-integration.md#flags-and-tool-inputs), so the docs, the playground and the Stage B binary agree without a second list to maintain.

### CLI flags

| Operation input | CLI | Example |
| --- | --- | --- |
| Path parameter | positional argument, in path order | `sendmock email update <emailId>` |
| Literal word in the catalogue command | fixed positional | `sendmock email check <emailId> html` |
| Query parameter or top-level body field (scalar) | `--kebab-case` flag | `to` → `--to`, `bounce_type` → `--bounce-type` |
| Boolean | `--name` sets true, `--no-name` sets false; an `is_` or `has_` prefix is dropped | `is_read` → `--read`, `--no-read` |
| List of scalars | the flag in the singular, repeated | `tags` → `--tag signup --tag qa` |
| Allowed values (enum) | validated; a wrong value exits with code 2 and lists the allowed ones | `--event bounced` |
| Object, or list of objects | the flag takes JSON (`--headers '{"X-Id":"1"}'`), or the whole body comes from `--data` / `--file` | `--data '{"steps":[...]}'` |
| File body (`message/rfc822`, uploads) | `--file <path>`, `-` for stdin | `sendmock sendmail --file welcome.eml` |

- Flags given next to `--data` or `--file` override the same keys.
- **Global flags** on every command: `--json`, `--url` (`SENDMOCK_URL`), `--token` (`SENDMOCK_TOKEN`), `--data`, `--file`, `--help`; `--yes` on destructive commands (DELETE). Exit codes as in [14](14-ai-integration.md#agent-friendly-conventions).
- **Overrides** go in the surface catalogue entry only where a rule gives a bad name: `cliFlags: { tags: "--tag" }` when the singular is not the name without its trailing `s`, or `cliFlags: { timeout_ms: "--wait" }` when a flag takes a friendlier unit (`--wait 10s`). A test (WS-07.5) fails when an override names an input that does not exist, or when two inputs of one command map to the same flag.

### MCP tool inputs

- One `inputSchema` object per tool: path parameters, query parameters and top-level body fields become top-level properties with their snake_case names, types, allowed values, descriptions and examples. File bodies are a `content` string (base64 for binary).
- **Result:** the operation's success response schema (`outputSchema`), and the tool's text content is the same JSON.
- **Annotations** from the method: GET `readOnlyHint`; DELETE `destructiveHint`; PUT, PATCH and DELETE `idempotentHint`. The catalogue may override (a POST that only reads, such as `sendmock_email_check` for links).
- **Shared tools:** when several operations share one tool (`sendmock_email_check` runs the html, links, spam and unsubscribe checks), the catalogue names the property that picks the operation, `mcpSelector: { kind: "html" }`, and the tool's input is the union with `kind` as a required enum.
- **Resources** (`sendmock://emails/{emailId}/raw`, ...) list their URI template, parameters and MIME type.
- **Toolset:** each catalogue area file sets the toolset its tools belong to (`email`, `sms`, `webhooks`, ...), matching the toolsets in [14](14-ai-integration.md#mcp-server).
- Same check as the CLI: a name clash between a path, query and body input of one tool fails the test.

### Generated contract files

`bun run openapi` also writes, next to the spec:

- `docs/api/cli-reference.json`: every command with its usage line, positional arguments, flags (name, type, required, allowed values, default, description, example), the operation it runs and an example command line.
- `docs/api/mcp-tools.json`: every tool with its `inputSchema`, `outputSchema`, annotations, toolset, the operations it runs and an example call, and every resource.

`openapi:check` fails when they drift. In Stage B the binary's `sendmock help --all --json` and the MCP server's `tools/list` are compared with these files (WS-03.2), so the CLI and agents get exactly what the docs promise. Deriving the files surfaces real gaps, which are fixed in the contract as part of this work; one found already: the guide uses `sendmock otp --to ... --wait 10s`, but `GET /otp` has no wait input. `/otp` and `/links` gain an optional `timeout_ms` (long poll, 408 on timeout, like the wait helpers), recorded in [06-api.md](06-api.md#test-automation-helpers).

## 3. The CLI and MCP reference pages

Two new sections on the website, built like the API reference (`/api/<tag>/`) from the generated files, one page per area with an anchor per entry:

**`/cli/<area>/#<command-slug>`**, e.g. `/cli/email/#email-update`:

```
sendmock email update <emailId> [flags]
Mark read or unread, or change tags.

Arguments   emailId      string, required   The email's ID, from `email list`.
Flags       --read, --no-read   boolean     Mark the email as read or unread.
            --tag <tag>  string, repeat     Replaces the email's tags.
Global      --json, --url, --token, --data, --file

Example     sendmock email update 01J9Z3... --read --tag signup --tag qa
Output      EmailSummary (with --json); exit 0, 3 when the email is not found
Also        PATCH /api/v1/emails/{emailId} · MCP sendmock_email_update · Mail > open email
```

**`/mcp/<area>/#<tool>`**, e.g. `/mcp/email/#sendmock_email_update`: the toolset, the annotations as badges (Read only, Destructive, Idempotent), the input table (name, type, required, allowed values, description), an example call as the arguments JSON, the result type, and links to the API operation, the CLI command and the app place. Exempt operations are listed with their reason. A short intro on `/mcp/` shows how to connect each agent (from `GET /ai/agents`) and how toolsets work.

- The header gets **CLI** and **MCP** next to **API**; `/cli/` and `/mcp/` index pages list every area and entry, and both are in the site search.
- **Links everywhere:** the "Other ways" list on every API operation links its CLI command and MCP tool; every CLI and MCP cell in the user guide's "From the CLI, API and AI" tables becomes a link, like the API cell:

  ```markdown
  | mark read, tag | [`sendmock email update <emailId>`](/cli/email/#email-update) | [`PATCH /api/v1/emails/{emailId}`](/api/email/#patchEmailsByEmailId) | [`sendmock_email_update`](/mcp/email/#sendmock_email_update) |
  ```

- [cli.md](../wiki/cli.md) and the [AI](../wiki/ai/index.md) pages link to the references; the reference entries link back to the guide page of their menu.
- **Check (WS-07.4):** the guide table test (UI-11.4) also fails when a CLI or MCP cell is not a link, or links to an entry that does not exist.

## 4. Playground: show every input

When an operation is picked, the empty area beside the path fields becomes an **Inputs** panel, and the body editor starts useful:

- **Inputs panel:** every path, query and body field the operation accepts (nested fields indented), with type, required, allowed values, default, description and example. Operations without a body say "No body". On narrow screens the panel sits under the form.
- **Body starts as a full example:** required and optional fields with their example values (from `examples`, falling back to the type), not only the required ones. `buildExampleValue` gains a mode for this; the API reference keeps showing the same example.
- **Add and remove fields:** each field in the panel has an **Add** or **Remove** button that edits the JSON body; **Reset to example** restores it.
- **Better controls:** query parameters with allowed values are dropdowns, booleans are switches.
- **Hints before sending:** a field the operation does not accept, a missing required field or a value outside the allowed ones is pointed out under the editor; sending still works, so readers can see the API's own error.
- **CLI and MCP tabs** join the snippets (cURL, PHP, ...): the command line and the MCP arguments JSON built from the same form values, each linking to its reference entry.
- The same Inputs panel is used by the per-operation **Try it** in the API reference, and the API reference's body table gains the Allowed values and Example columns.

## 5. Code examples in every supported language

The guide adds the code a developer writes, in the languages SendMock's [Connect](../wiki/connect/index.md) pages support:

| Tab | Stack used in the examples |
| --- | --- |
| CLI | `sendmock` commands |
| PHP | Laravel (`Http` client, Pest or PHPUnit feature test) |
| JavaScript | Node (`fetch`, Vitest or Jest) |
| Python | `requests`, pytest |
| Go | `net/http`, `testing` |
| Java | `java.net.http`, JUnit 5 |
| Rust | `reqwest`, `#[tokio::test]` |
| Ruby | `Net::HTTP`, RSpec |
| C# | `HttpClient`, xUnit |

Examples call the REST API with the language's standard HTTP client (there are no SendMock SDKs), point at `http://127.0.0.1:8025`, and are short and complete: the setup line, the call, the assertion. Each is what a developer would paste into a real test, not a fragment.

**Where:**

- **Every recipe** (13) gets an **In your code** section after its steps, with the whole flow in each language. Example, [Read a one-time code](../wiki/recipes/read-a-code.md) in PHP:

  ```php
  it('signs up with the emailed code', function () {
      $this->post('/register', ['email' => 'user@example.test'])->assertRedirect('/verify');

      $otp = Http::get('http://127.0.0.1:8025/api/v1/otp', [
          'to' => 'user@example.test',
          'timeout_ms' => 10000,
      ])->throw()->json('code');

      $this->post('/verify', ['code' => $otp])->assertRedirect('/dashboard');
  });
  ```

- **Every menu page** gets a **From your code** section before "From the CLI, API and AI": the screen's most common task (Mail: wait for the newest email and read its link; SMS: send and read a reply; Webhooks: create an endpoint and check a delivery; ...).
- **Connect pages** keep their setup snippets and link to the recipes for the rest.

**How they are written:** Markdown code blocks with a tab title, which Fumadocs renders as tabs (its `remarkCodeTab` plugin, already in the build) and GitHub shows as one labelled block per language, so `docs/wiki/` still reads well on GitHub:

````markdown
```php tab="PHP"
...
```

```js tab="JavaScript"
...
```
````

The chosen language is remembered across pages and visits (Fumadocs `groupId` and `persist`), and the tabs work with the keyboard.

**Checks (WS-08.3):** a docs test reads every example block and fails when a recipe or menu page is missing a language, when an `/api/v1/...` method and path is not in the spec, when a JSON key or query name sent to an operation is not one of its inputs, or when a `sendmock` command or flag is not in `cli-reference.json`. In Stage B the cross-language matrix (`examples/`, [AGENTS.md](../../AGENTS.md#test-layers)) runs the recipe examples against a real binary (WS-08.5).

## What is not in this plan

- Response field descriptions for types used only in responses (a follow-up once inputs are done).
- SendMock client SDKs; examples use each language's HTTP client.
- Versioned references (`/next/`, `/vX.Y/`), which come with WS-03 in Phase 0.

## Phase and gate

U3 W15, on `docs/user-guide-plan`. The field docs, the flag and input rules and the generated `cli-reference.json` and `mcp-tools.json` are **inside the sign-off gate**: Stage B builds the CLI and MCP server from them. The reference pages, the playground panel and the code examples are docs and do not block the sign-off, but are planned to land before it.

## Acceptance criteria

In [acceptance/07-distribution-website.md](acceptance/07-distribution-website.md): WS-07.1 to WS-07.5, WS-08.1 to WS-08.5, and WS-04.4 to WS-04.6.

## Order of work

On `docs/user-guide-plan`, one commit per step:

1. Plan: this document, [14-ai-integration.md](14-ai-integration.md) (flag and tool input rules), [06-api.md](06-api.md) (`timeout_ms` on `/otp` and `/links`), [19-user-guide.md](19-user-guide.md) (the From your code and In your code sections), [16-website-and-releases.md](16-website-and-releases.md) (the `/cli/` and `/mcp/` sections), acceptance criteria, PROGRESS.
2. Field docs: descriptions and examples on every input type and query parameter, extended JSDoc in the generator, the WS-07.1 test.
3. Derivation: the CLI and MCP builders, catalogue overrides (`cliFlags`, `mcpSelector`, annotations, toolsets), `cli-reference.json` and `mcp-tools.json`, the drift check and the WS-07.5 tests; contract gaps it finds fixed.
4. Website: `/cli/` and `/mcp/` pages, header and search, links from the API reference and the guide tables; WS-07.2 to WS-07.4 tests.
5. Playground: the Inputs panel, the full example body, add and remove, controls, hints, CLI and MCP snippet tabs; WS-04.4 to WS-04.6 tests (Vitest for the builders, Playwright for the panel).
6. Code examples: the 13 recipes, then the menu pages; WS-08.1 to WS-08.4 tests.
7. PROGRESS, as-built notes and the update log.
