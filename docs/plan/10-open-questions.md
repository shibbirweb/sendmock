# 10. Open Questions

Decisions to make before or during implementation. Each has a recommendation so work can start without blocking.

## 1. Product name

The folder is `mail-sms-server`; `mss` is a placeholder. With payments and the HTTP catcher the product is broader than mail and SMS, so the name should cover "third-party services sandbox", not only mail and SMS. It will be published from the `shibbirweb` GitHub account (`github.com/shibbirweb/<name>`, `ghcr.io/shibbirweb/<name>`, npm `@shibbirweb/<name>`). Criteria: short CLI command (3-8 chars), free on crates.io, npm, Homebrew, Docker Hub and GitHub, and a `.dev` or `.sh` domain.

Brainstorm candidates (availability not yet checked):

| Name | Idea |
|------|------|
| `postbox` | catches every message |
| `inkwell` | mail + text |
| `catchall` | literal SMTP behaviour |
| `pigeon` | carries both mail and messages |
| `relaybox` | receive and forward via webhooks |
| `hookpost` | webhook-first angle |
| `msgpit` | nod to Mailpit, covers SMS |

**Action:** pick 2-3 favourites, check availability, then rename crates, env prefix (`MSS_`), seed file name (`mss.seed.toml`) and Docker image. (Webhook signature headers follow Standard Webhooks, so they do not carry the product name.)

## 2. Default ports

- **Option A (recommended):** SMTP `1025`, HTTP `8025`. Drop-in for existing Mailpit/MailHog configs. Downside: conflicts if both tools run at once.
- **Option B:** unique ports (e.g. `2025` / `8125`) to coexist.

Recommendation: A, with a clear "port in use" error message suggesting `--http-addr`.

## 3. Provider emulation priority

Recommended order: Twilio, Vonage, then generic GET/POST (for regional vendors, including Bangladeshi providers that use query-string APIs), then Plivo, MessageBird, Infobip, AWS SNS. Which regional vendors matter most to early users?

## 4. SDK redirection approach

For each official SDK, determine the cleanest supported way to change the base URL or inject an HTTP client. If a popular SDK makes this hard, consider documenting an HTTP proxy approach (`HTTPS_PROXY` plus a local CA) as a fallback, which adds complexity (TLS MITM) and should be optional.

## 5. Storage of attachments

- **Option A (recommended):** keep everything inside SQLite (compressed raw message). Single file, easy reset.
- **Option B:** raw messages as files on disk, metadata in SQLite. Better for very large mailboxes.

Recommendation: A for v1; revisit if users report DBs over ~1 GB.

## 6. Frontend router and bundler

TanStack Router + Vite is recommended (mature shadcn support). Bun's built-in HTML bundler is an option to drop Vite later if it covers Tailwind v4 and shadcn cleanly.

## 7. Licence

MIT or Apache-2.0 (dual licence is the Rust norm). Recommendation: dual MIT/Apache-2.0.

## 8. Telemetry

Recommendation: none. Opt-in update check only.

## 9. Mailpit API compatibility

Worth offering compatibility aliases so existing Mailpit-based test suites can switch with no code change? Recommendation: yes, as a stretch goal after 1.0 if there is demand.

## 10. Persistence default

In-memory by default (like MailHog) or on-disk SQLite by default (like Mailpit with `--database`)? Recommendation: on-disk at the OS data dir, with `--db memory` for CI, because webhook rules and endpoints should survive restarts.

## 11. caniemail data licence

The HTML compatibility check embeds the caniemail.com support dataset (as Mailpit does). Confirm the dataset's licence and attribution requirements before shipping.

## 12. Strictness defaults for provider emulation

Lenient by default (unknown Messaging Service SIDs auto-created, any `From` accepted, any credentials accepted) with per-provider "strict mode" to reproduce real provider errors. Confirm this default with early users; strict-by-default catches more bugs but makes first setup harder.
