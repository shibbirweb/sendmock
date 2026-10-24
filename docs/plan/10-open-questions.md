# 10. Open Questions

Decisions to make before or during implementation. Each has a recommendation so work can start without blocking.

## 1. Product name (decided 2026-10-25: MessageHook)

**MessageHook**: messages (email, SMS) and webhooks in one name; payment IPNs and every other event are delivered as hooks too. Binary and packages `messagehook`, published from the `shibbirweb` GitHub account.

| Channel | Name |
|---------|------|
| GitHub | `github.com/shibbirweb/messagehook`, Pages `shibbirweb.github.io/messagehook/` |
| Binary, crates.io, Homebrew, Scoop, PyPI | `messagehook` |
| npm | `messagehook` (free) or `@shibbirweb/messagehook` |
| Docker | `ghcr.io/shibbirweb/messagehook` |
| Domains | no live site on `messagehook.com`, `.io`, `.dev` or `.app`; register `messagehook.dev` (and `.com` if available) |
| Env, files, MCP | `MESSAGEHOOK_*`, `messagehook.toml`, `messagehook.seed.toml`, `messagehook_*` tools |

How it was chosen (2026-10-25). Each candidate was checked on crates.io, npm, PyPI, Homebrew and Scoop, by loading its `.com`, `.io`, `.dev` and `.app` websites, and by a web search for existing products:

- **Rejected for existing brands in our space:** Gateway Lab (`gatewaylab.net` belongs to GatewayAPI, an SMS gateway), MailSMS and MailSMS Box (CM.com sells "Mail SMS"), Sendlab (several email marketing businesses), Outbox Lab (email outreach SaaS), SMSHook (Indian bulk SMS provider), PingPost (lead-generation company and industry term), Postnest (social media scheduler), Sendvault (New York State file-transfer tool), Sendpark (one letter from Sendspark).
- **Clear alternatives kept on file:** Pingyard, Sendyard, Sendcatch, Letterbay, Sendward, Mocksend, Mock Outbox, PayPost.
- Most single English words (Courier, Pigeon, Mailroom, Postmaster, Front Desk, ...) are taken on crates.io or npm.
- "MessageHook" otherwise appears only as an old Windows API term (message hooks), not as a product.

**Remaining check:** search "MessageHook" in the USPTO, EUIPO and WIPO trademark databases (and Bangladesh DPDT if registering locally) before investing in branding; web searches found no product or company using the name. A short CLI alias (for example `mhook`) can be added later if the full command feels long.

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
