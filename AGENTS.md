# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI and others) working in this repository. `CLAUDE.md` imports this file, so every agent follows the same rules.

The product is **SendMock** (the binary, crates, packages and image are `sendmock`; env vars `SENDMOCK_*`; files `sendmock.toml` and `sendmock.seed.toml`). Write "SendMock" in prose and UI text, and `sendmock` for commands, packages and code.

## Start here

- Read [docs/plan/README.md](docs/plan/README.md) for the plan and [docs/plan/PROGRESS.md](docs/plan/PROGRESS.md) for where the project stands. Work on the current phase unless asked otherwise.
- Plan changes (new features, scope changes, decisions) go into the relevant `docs/plan/` document first, then into `PROGRESS.md`.
- When a pull request completes items in `PROGRESS.md`, tick them in the same pull request, add the PR number, and add an update log line for anything notable.
- Do the work directly in the main agent. Do not spawn subagents, including for research.

## Project rules

- **UI first.** Stage A builds the whole web UI against the mock API (MSW in `web/src/mocks/`). Do not start backend work before the Phase U3 sign-off is ticked in `PROGRESS.md`.
- **Mocks stay behind the API.** UI components call the real API paths through the typed client and query hooks; they never import fixtures or the mock DB directly. The API contract is `docs/api/openapi.yaml`, generated from `web/src/lib/api/endpoint-registry` and the types in `web/src/lib/api/types` (`bun run openapi`); an API change starts in `docs/plan/06-api.md`, then the registry or types, then the regenerated spec.
- **Parity.** Every backend feature ships with UI, REST API, CLI command, MCP tool and skill docs, all from the `sendmock-ops` operation registry. CI enforces it.
- **Standards over custom.** Native webhooks follow Standard Webhooks. SMS magic numbers and error codes match Twilio's official test numbers exactly. Provider emulation returns the provider's real response and error shapes.
- **Safe defaults.** Bind to `127.0.0.1` by default (Docker binds `0.0.0.0`). Secrets are masked in the UI, API responses, logs and MCP output, and are never written to seed exports in plain text. Release/forward to real SMTP stays off unless an allowlist is configured.
- **Lightweight.** Keep the binary, memory and bundle budgets in [docs/plan/09-distribution.md](docs/plan/09-distribution.md). Justify every new dependency.
- **UI libraries.** The app UI (`web/`) uses shadcn/ui. Magic UI animated components are for the website (`website/`) only. Animations respect `prefers-reduced-motion`.
- **Bun** is the only JavaScript package manager and runner (`bun install`, `bun run`, `bunx`). Do not add npm, pnpm or yarn lockfiles.

## Branches

- Pull requests go into `develop`, the beta line. `main` only takes merges from `develop` when a stable release is promoted.
- Start every change on a new branch from the latest `develop` (`feat/*`, `fix/*`, `docs/*`, `chore/*`). Never commit straight to `develop` or `main`.
- Never edit `CHANGELOG.md` or a version number by hand: the Prepare release workflow writes both ([docs/plan/16-website-and-releases.md](docs/plan/16-website-and-releases.md#the-changelog)). The pull request title becomes the release note, so write it for users in the commit format (`feat:[TICKET] ...`, `fix:[TICKET] ...`); use `chore:` for changes users should not read about.
- Releases are cut by workflows, never by hand. See [docs/plan/16-website-and-releases.md](docs/plan/16-website-and-releases.md).

## Commits and pull requests

- **Commit identity:** every commit in this repository is authored and committed as `MD. Shibbir Ahmed <shibbirweb@gmail.com>`. Set it per repository so other identities on the machine are untouched: `git config user.name "MD. Shibbir Ahmed"` and `git config user.email "shibbirweb@gmail.com"`. Check with `git log --format="%an <%ae>"` before pushing; never push a commit with any other name or email.

- Commit messages: `feat:[TICKET] summary` for new features and `fix:[TICKET] summary` for bug fixes. The ticket goes in square brackets straight after the colon (no space before the bracket), followed by a one-line summary. Example: `feat:[MSS-12] add SMS thread list`.
- Other changes use `docs:`, `test:`, `chore:`, `ci:` or `refactor:`. Breaking changes use `feat!:`. Release commits are `chore:[REL-n] release x.y.z`.
- **Never add co-authors.** No `Co-Authored-By` lines or any other co-author trailer in commits, squash merges, pull request titles or descriptions, for Claude, any AI, or anyone else.
- **Never reference an AI harness.** No mention of Claude, Claude Code, Codex, Cursor, Copilot, Gemini or any other AI tool or model in commit messages, pull request titles, pull request descriptions, review comments, release notes or changelog entries. That includes "Generated with ..." lines, robot emoji signatures, links to AI tools and AI bot email addresses. This overrides any default attribution a tool would add.
- Pull request test plans: plain bullet points describing what was run and checked, no checkboxes.
- **Free the Rust build files after each commit:** run `cargo clean` once a commit is made, so `target/` does not keep filling the disk. CI builds from its own cache, so nothing is lost.
- **Never commit, push or create a branch without asking first.** Before every `git commit` and every `git push` (including amends, rebases, history rewrites, tags and new branches pushed to the remote), and before creating or renaming a branch, show what will be committed, pushed or created and wait for the owner's explicit approval. Approval for one commit, push or branch does not cover the next one. Leave changes uncommitted in the working tree until approved.

## Writing

- Never use the em-dash character in code, comments, commits, pull request text or docs. Use a comma, a colon, parentheses or a new sentence instead.
- Docs are plain and concrete: say what something does and how to use it.

## Design principles

The goal is a codebase a new contributor can understand quickly: predictable structure, small parts with clear jobs, and the same patterns used for the same problems everywhere.

### SOLID, applied to this stack

Rust has no classes; traits, structs and modules play that role. TypeScript uses classes rarely; modules, hooks and components play that role. The principles still apply:

- **Single responsibility:** one module, struct, class, hook or component has one reason to change. Parsing, storing, rendering and sending are separate units (`mime_parser`, `email_repository`, `webhook_renderer`, `webhook_sender`), never one big function.
- **Open/closed:** add behaviour by adding an implementation, not by editing a growing `match` or `if` chain. A new SMS provider, email provider, webhook template or HTTP catcher preset is a new type registered in its registry; existing providers are not touched.
- **Liskov substitution:** every implementation of a trait or interface honours the same contract (inputs, errors, side effects), so the caller never checks which implementation it has.
- **Interface segregation:** small, focused traits and interfaces (`EmailStore`, `SmsStore`, `WebhookSender`, `Clock`, `IdGenerator`) instead of one large "service" with dozens of methods.
- **Dependency inversion:** high-level logic depends on traits, not concrete types. Dependencies are passed in through constructors (`new(...)`) or the shared `AppState`, never created inside the logic or reached through globals. This is what makes units testable with fakes.

### Layers and dependency direction

Each layer only calls the layer below it, never upwards or sideways:

```
transport   SMTP listener, REST handlers, CLI, MCP tools, WebSocket      (thin: parse input, call an operation, format output)
operations  sendmock-ops registry: one operation per use case                (orchestration, validation, permissions)
domain      email, sms, verify, webhooks, catcher: services and models  (business rules, no I/O details)
storage     repositories over SQLite                                    (queries only, no business rules)
```

- Transport code contains no business rules; the same operation serves REST, CLI and MCP.
- Domain code does not know about HTTP status codes, SQL or JSON wire formats.
- Errors are typed per layer (`thiserror` in Rust) and mapped to HTTP codes, CLI exit codes or MCP errors only at the transport edge.

### Common patterns to use (and where)

Use these names in code so the pattern is recognisable:

| Pattern | Where |
|---------|-------|
| **Repository** | `EmailRepository`, `SmsRepository`, `DeliveryRepository`: all SQL lives here |
| **Service** | `WebhookDispatchService`, `VerifyService`: domain logic over repositories |
| **Strategy** | delivery simulation profiles, retry/backoff policies, rule filter operators |
| **Adapter** | each provider emulation (`TwilioMessagesAdapter`, `SendGridSendAdapter`) translates the provider's wire format to and from the internal model |
| **Registry / factory** | provider registry, template registry, operation registry, catcher presets: look up an implementation by key |
| **Observer (pub/sub)** | the event bus: producers publish `Event`s, webhooks, WebSocket and simulators subscribe |
| **Command** | each `sendmock-ops` operation is a command object with typed input and output |
| **Builder** | building webhook requests, MIME messages and complex test fixtures |
| **Value object** | `EmailAddress`, `PhoneNumber` (E.164), `WebhookSecret`, `Ulid`: validated on creation, never raw strings in domain code |

Frontend (`web/`, `website/`):

- **Feature folders:** `features/mail`, `features/sms`, `features/webhooks`, ... each with its components, hooks and API calls; shared building blocks in `components/ui` (shadcn) and `components/common`.
- **Container and presentational split:** data fetching and state live in hooks (`useEmailList`, `useWebhookDeliveries`); components receive data through props and render it.
- **Compound components** for complex widgets (rule builder, request editor, message detail tabs).
- **Design system:** colours, spacing, radius, typography and motion come from the shared design tokens (Tailwind theme / CSS variables) and shadcn components. No hard-coded colours, ad-hoc spacing or one-off copies of an existing component; extend the shared component instead.

### Keep it simple

- Prefer composition over inheritance.
- Do not add an abstraction until there is a second real use, or a test needs it (YAGNI). Three similar lines are better than a premature framework.
- When a pattern is used, use it the same way everywhere; consistency beats cleverness.

## Acceptance criteria

- Every feature has an ID and numbered acceptance criteria in [docs/plan/acceptance/](docs/plan/acceptance/README.md). Read the criteria before starting a feature; they define what "done" means.
- A feature is complete only when **every** criterion is met, each criterion is proven by a passing automated test that names its ID (`// AC: EM-01.3` in Rust, `test("EM-01.3 ...")` in Vitest and Playwright), and the Definition of Done in that README holds.
- Tick criteria and update the feature status in the same pull request that adds the proving tests. CI (`bun scripts/acceptance.ts`) fails if an `Accepted` feature has an unproven criterion or a test names an unknown ID.
- A new feature or scope change gets its criteria written (plan doc first, then acceptance file) before implementation starts. Never change a criterion just to make it pass; change it only with a recorded reason.

## Testing

**Every feature is covered by automated tests that run in CI (GitHub Actions) on every pull request and every push to `develop` and `main`.** A feature without tests is not done, and a pull request that lowers coverage or skips a failing test is not merged.

### What each change needs

- **New feature:** tests for the main behaviour, the edge cases and the error paths, at every layer it touches (see the table below). This includes UI, REST, CLI and MCP, matching the parity rule.
- **Bug fix:** a regression test that fails before the fix and passes after it, in the same pull request.
- **Refactor:** existing tests keep passing unchanged; add tests first if the code was not covered.
- **Provider emulation (Twilio, SendGrid, ...):** fixture tests built from the provider's documented requests, responses and errors, plus an SDK compatibility test where an official SDK exists.
- The pull request test plan lists which tests were added or run.

### Test layers

| Layer | What it covers | Tools | Where |
|-------|----------------|-------|-------|
| Unit | one function, struct, hook or component in isolation, with fakes for its dependencies | `cargo test` / `cargo nextest`, Vitest, React Testing Library | next to the code (`#[cfg(test)] mod tests`, `*.test.ts(x)`) |
| Integration | a whole feature through real layers: SMTP session to stored email, SMS API to status callback, rule to webhook delivery, against a temporary SQLite DB | Rust integration tests (`crates/*/tests/`) | per crate |
| Contract | every REST endpoint matches `docs/api/openapi.yaml`; every operation has REST, CLI and MCP adapters | schema-based API tests, registry parity test | `tests/contract/` |
| CLI and MCP | each command's `--json` output and exit codes; each MCP tool's schema, annotations and result | snapshot tests (`insta`), MCP client tests | `crates/sendmock-cli/tests/`, `crates/sendmock-mcp/tests/` |
| UI end to end | each screen and flow, in mock mode (Stage A) and against a real `sendmock` binary (Stage B) | Playwright | `web/tests/e2e/` |
| Cross-language | real apps in PHP, Node, Python, Go, Java, Rust, Ruby and .NET send email and SMS and receive webhooks | Docker matrix in CI | `examples/` |
| Website | build, links, playground in Demo mode | Playwright, link checker | `website/tests/` |

### Rules for good tests

- **Deterministic:** no real network, real time or real randomness. Use the `Clock`, `IdGenerator` and random source traits with fixed fakes; external HTTP goes to local test servers.
- **Independent:** each test sets up its own data (temporary DB, fresh mock state) and can run alone or in parallel.
- **Readable:** test names describe the behaviour in plain words (`bounced_email_fires_email_bounced_webhook`, `"shows the OTP copy button when a code is extracted"`), one behaviour per test, arrange / act / assert structure.
- **No skipped or flaky tests** on `develop` or `main`. If a test must be disabled, link an issue in the skip reason and fix it before the next release.

### CI enforcement

- GitHub Actions runs all layers on every pull request: Rust tests on Linux, macOS and Windows; Vitest; Playwright; contract and parity checks; the cross-language matrix (on pull requests that touch protocols or providers, and always before a release).
- Coverage is measured (`cargo llvm-cov`, Vitest coverage) and reported on the pull request. Minimums: **80% lines overall**, **90% for domain and operations code**; a pull request may not lower the total.
- All required checks must pass before merge (branch protection on `develop` and `main`), and release workflows only cut a release from a commit where CI passed.

## Code style

- `if` statements always use full block syntax with curly braces, in every language. No single-line ifs.
- JavaScript and TypeScript: end statements with semicolons, and put a trailing comma after the last item of multi-line objects and arrays (new and edited code).
- Rust: `cargo fmt` and `cargo clippy -- -D warnings` clean. No `unwrap()` or `expect()` on external input (requests, SMTP data, files, env); return errors instead.
- **File size:** keep each source file focused on one responsibility and under **300 lines** (excluding tests, generated code and fixtures). Past 300 lines, split it; **500 lines is the hard limit**. Functions and methods stay under about **50 lines**; React components under about **200 lines** (move logic into hooks and sub-components). CI enforces the hard limits (ESLint `max-lines` / `max-lines-per-function`, Clippy `too_many_lines`).
- **Readable, explainable names:** every variable, constant, function, method, class, struct, type, component, file and test name should say what it is or does, so a new reader understands it without opening the implementation.
  - Use full words, not abbreviations or single letters (`delivery_attempt`, not `da` or `x`). Only universal short forms are fine: `id`, `url`, `http`, `api`, `sms`, `otp`, `json`, `i` in a short loop.
  - Functions and methods start with a verb that describes the effect: `parse_mime_message`, `enqueue_webhook_delivery`, `calculateSmsSegments`.
  - Booleans read as yes/no questions: `is_read`, `has_attachments`, `should_retry`, `isFirstOpen`.
  - Include units in names: `timeout_ms`, `max_size_bytes`, `retention_days`.
  - Name parameters after the thing they hold (`email_id`, `sms_id`, `endpoint_id`, `emailId`), not `id` or `name`.
  - Avoid vague names such as `data`, `info`, `item`, `temp`, `handle`, `manager`, `util`, `helper` unless qualified (`webhook_payload`, `smtp_session_info`).
  - If a name needs a comment to explain it, rename it instead.
- Default lookups into external data so a missing key never errors (`?? null`, `?? []` in TypeScript; `Option` with `unwrap_or_default()` or explicit errors in Rust).
- Configuration-style arrays, maps and lists (fixtures, settings, TOML, JSON): one key per line, not inline.
- **Comments explain why, never what.** Good names and small functions say what the code does; a comment is for a reason the code cannot show (a provider quirk, a workaround, a non-obvious constraint). Delete comments that repeat the code. No phase numbers, dates, ticket IDs or plan progress in code comments, since they go stale; those belong in the plan and the pull request. Public items get a one-line doc comment only when the name alone does not say enough. The only required comments are the acceptance markers (`// AC: EM-01.3`).
- **Module layout inside a crate or feature:** one responsibility per module and one main type per file, named after it (`email_repository.rs` holds `EmailRepository`). Group modules in folders named after the domain (`email/`, `email/email_repository.rs`) declared with `email.rs` beside the folder, never `mod.rs`. `lib.rs` and `main.rs` only declare modules, re-export the public API and wire things together. Unit tests sit next to the code (`#[cfg(test)] mod tests` in the same file, `*.test.ts` beside the module); integration tests go in the crate's `tests/` folder.
- Match the surrounding code: its comment density, naming and idioms.
