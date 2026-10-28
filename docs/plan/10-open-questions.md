# 10. Open Questions

Decisions to make before or during implementation. Each has a recommendation so work can start without blocking.

## 1. Product name (decided 2026-10-25: SendMock)

**SendMock**: "send it to the mock". Your app sends email, SMS, payments, webhooks and other HTTP to SendMock instead of the real services, and SendMock catches, shows and answers them. Binary and packages `sendmock`, published from the `shibbirweb` GitHub account.

| Channel | Name |
|---------|------|
| GitHub | `github.com/shibbirweb/sendmock`, Pages `shibbirweb.github.io/sendmock/` |
| Binary, crates.io, Homebrew (formula and cask), Scoop, PyPI, Packagist, RubyGems, NuGet | `sendmock` (all free on 2026-10-25) |
| npm | `sendmock` (free) or `@shibbirweb/sendmock` |
| Docker | `ghcr.io/shibbirweb/sendmock` (Docker Hub `sendmock` also free) |
| Domains | `sendmock.com`, `.io`, `.dev`, `.app`, `.net`, `.org` all unregistered on 2026-10-25: register `sendmock.com` and `sendmock.dev` |
| Env, files, MCP | `SENDMOCK_*`, `sendmock.toml`, `sendmock.seed.toml`, `sendmock_*` tools |

Why SendMock:

- **Unique:** an exact-name web search returns no product, company or project. Nearby results are generic test helpers (sgmock, the deprecated sendgrid-stub, MockMock), not brands.
- **Developer friendly:** an 8-letter lowercase command, says what it does, easy to say and spell.
- **Fully ownable:** every package registry name and every common domain is free.

How it was chosen (2026-10-25). Candidates were checked on package registries, by loading their `.com`, `.io`, `.dev` and `.app` sites, by domain registration (RDAP) and by exact-name web searches:

- **Rejected for existing brands or conflicts:** Gateway Lab (`gatewaylab.net` belongs to GatewayAPI, an SMS gateway), MailSMS (CM.com's "Mail SMS" product), Sendlab (several email marketing businesses), Outbox Lab, SMSHook (Indian bulk SMS provider), PingPost (lead generation), Postnest (social scheduler), Sendvault, Sendpark (Sendspark), Pingmere and other "Ping" names (Ping Identity actively opposes "PING" marks), Courion, Mittio (Mitto SMS), Messio (Messagio), Envoyo (Envoy proxy), Dingbox, Beepost (bpost), MessageHook (descriptive; a Landbot feature name; the `.com` is parked for sale).
- **Clear alternatives kept on file:** SendMockway (the "Mockway" part is an existing Scaleway mock server project), Telvara, Heraldyn, Msgvane, Missivio, Missivr, Hootpit, Hookwick, Gatepit, Mockway, Sandport, Pigeonix.

**Remaining check:** search "SendMock" in the USPTO, EUIPO and WIPO trademark databases (and Bangladesh DPDT if registering locally) before investing in branding. **Deferred on 2026-10-29** to before 1.0 (Phase 5, "Final product name applied everywhere"); nothing in Phases 0 to 4 depends on it.

## 2. Default ports (decided 2026-10-29: 1025 / 8025)

- **Option A (recommended):** SMTP `1025`, HTTP `8025`. Drop-in for existing Mailpit/MailHog configs. Downside: conflicts if both tools run at once.
- **Option B:** unique ports (e.g. `2025` / `8125`) to coexist.

Recommendation: A, with a clear "port in use" error message suggesting `--http-addr`.

**Decided 2026-10-29:** Option A, SMTP `1025` and HTTP `8025`, with the "port in use" message from PL-07.3.

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

## 7. Licence (decided 2026-10-29: MIT OR Apache-2.0)

MIT or Apache-2.0 (dual licence is the Rust norm). Recommendation: dual MIT/Apache-2.0.

**Decided 2026-10-29:** dual licence, `MIT OR Apache-2.0` in `Cargo.toml`, with `LICENSE-MIT` and `LICENSE-APACHE` at the repository root and in every release archive.

## 8. Telemetry

Recommendation: none. Opt-in update check only.

## 9. Mailpit API compatibility

Worth offering compatibility aliases so existing Mailpit-based test suites can switch with no code change? Recommendation: yes, as a stretch goal after 1.0 if there is demand.

## 10. Persistence default (decided 2026-10-25)

In-memory by default (like MailHog) or on-disk SQLite by default (like Mailpit with `--database`)? **Decided:** on-disk SQLite at the OS data directory, with `--db memory` for CI, because webhook rules and endpoints should survive restarts. See [Database: SQLite](02-architecture.md#database-sqlite).

## 11. caniemail data licence

The HTML compatibility check embeds the caniemail.com support dataset (as Mailpit does). Confirm the dataset's licence and attribution requirements before shipping.

## 12. Strictness defaults for provider emulation

Lenient by default (unknown Messaging Service SIDs auto-created, any `From` accepted, any credentials accepted) with per-provider "strict mode" to reproduce real provider errors. Confirm this default with early users; strict-by-default catches more bugs but makes first setup harder.

## 13. Install script URL (decided 2026-10-27: GitHub release assets)

`install.sh` and `install.ps1` are attached to every GitHub release and fetched through GitHub's "latest release" link, so the commands never change and always install the newest stable:

```bash
curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh
```

```powershell
irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 | iex
```

The beta comes from the same scripts with `--channel beta`. Considered and not chosen: the website (`https://shibbirweb.github.io/sendmock/install.sh`, shorter but served from the site's branch) and a raw file in the repository (tied to the branch layout). The install page and the landing page's quick start use these URLs.
