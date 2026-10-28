# 23. Phase 0: backend foundations

Phase 0 is the first Stage B phase. It builds the Rust side that every later phase stands on: the Cargo workspace, configuration, the HTTP server with the embedded UI, SQLite, the operation registry with its first REST, CLI and MCP surfaces, the seed loader, the contract tests, Rust CI, and the release and Docker machinery. No email, SMS or webhook feature is built here; those start in Phase 1 ([11-roadmap.md](11-roadmap.md#phase-0-backend-foundations-about-1-week)).

## Goal and done-when

**Done when** (from [11](11-roadmap.md#phase-0-backend-foundations-about-1-week)): SendMock starts, serves the embedded UI at `:8025` (still in mock mode), and `/api/v1/health` returns 200 on Linux, macOS and Windows. In full:

- every Phase 0 item in [PROGRESS.md](PROGRESS.md) is ticked;
- a CI job builds the binary on all three operating systems, starts it, gets `200` from `/api/v1/health` and the UI's `index.html` from `/`, and stops it with a clean exit;
- the Phase 0 criteria in [Criteria](#criteria) have passing tests that name them;
- the Rust CI jobs, coverage gate and file size checks are required checks on `develop` and `main`;
- a dry run of Prepare release prints `0.1.0-beta.1` and its changelog section, and a manual run of `release.yml` (no publishing) builds and tests every target.

The first published beta, `0.1.0-beta.1`, belongs to Phase 1, since it is the first version with something to use.

## Before it starts (W0)

Three placeholder decisions are still open ([10](10-open-questions.md)). Phase 0 needs two of them, so W0 settles them in the plan before any code:

| Question | Needed by | Recommendation |
|----------|-----------|----------------|
| Default ports | W3 (config defaults), W11 (Docker `EXPOSE`) | SMTP `1025`, HTTP `8025` (Mailpit compatible), with the "port in use" message from PL-07.3 |
| Licence | W1 (`license` in `Cargo.toml`), W12 (licence files) | dual `MIT OR Apache-2.0`, the Rust norm |
| "SendMock" trademark check | branding, not code | may be deferred to before the first stable; nothing in Phase 0 depends on it |

The owner records each decision in [10](10-open-questions.md) and in Decisions > Made in [PROGRESS.md](PROGRESS.md).

**Decided 2026-10-29:** ports `1025` / `8025`, licence `MIT OR Apache-2.0`, and the trademark check deferred to before 1.0.

## Workstreams and order

All Phase 0 workstreams are built on one branch, `feat/phase-0`, with a commit per workstream, and one pull request into `develop` whose CI runs the tests on each push (decided 2026-10-29, as in U3); the Branch column names the part only. Each commit is made after the owner approves it ([AGENTS.md](../../AGENTS.md#commits-and-pull-requests)). W9 and W12 only need W1 and can be done in any order after it.

| # | Workstream | Branch | Criteria | Depends on |
|---|------------|--------|----------|------------|
| W0 | Placeholder decisions | `docs/phase-0-decisions` | | |
| W1 | Cargo workspace and crate skeletons | `feat/p0-workspace` | | W0 |
| W2 | Rust CI and test setup | `ci/p0-rust` | | W1 |
| W3 | Config, tracing and graceful shutdown | `feat/p0-config` | PL-07.1 to PL-07.3, PL-06.1 (native half) | W2 |
| W4 | SQLite store and migrations | `feat/p0-store` | | W2 |
| W5 | HTTP server, operation registry and embedded UI | `feat/p0-http-server` | DS-01.2 (host build) | W3, W4 |
| W6 | CLI skeleton, MCP tool definitions and parity check | `feat/p0-cli` | AI-01.1, AI-01.2, AI-01.3, AI-01.5 | W5 |
| W7 | Seed loader skeleton | `feat/p0-seed` | PL-04.5 | W6 |
| W8 | OpenAPI contract tests | `test/p0-contract` | PL-01.3 | W5 |
| W9 | Version script and changelog | `feat/p0-version` | DS-05.1 to DS-05.4 | W1 |
| W10 | Release workflows | `ci/p0-release` | DS-04.2, DS-04.4, DS-04.5 | W5, W9 |
| W11 | Dockerfile and `edge` image | `ci/p0-docker-edge` | DS-02.1, DS-02.2, DS-02.5, PL-06.1 (Docker half) | W5 |
| W12 | README and licence | `docs/p0-readme` | | W0, W1 |

The PROGRESS item "Versioned website builds" is no longer part of Phase 0: it moved to U3 W17 on 2026-10-27 and was finished there (#40).

## W1: Cargo workspace and crate skeletons

- A workspace `Cargo.toml` at the repository root with the crates from [02](02-architecture.md#repository-layout): `sendmock` (the binary), `sendmock-core`, `sendmock-store`, `sendmock-smtp`, `sendmock-sms`, `sendmock-webhooks`, `sendmock-ops`, `sendmock-api`, `sendmock-cli` and `sendmock-mcp`. Crates with no Phase 0 code (`smtp`, `sms`, `webhooks`) are created empty with a one-line doc comment, so the layout and dependency direction are fixed from the start.
- `[workspace.package]` holds `version = "0.0.0"`, `edition = "2024"`, `license` (from W0), `repository` and `rust-version`. The version is the source of truth that W9 syncs.
- `rust-toolchain.toml` pins the stable toolchain with `rustfmt` and `clippy`, so CI and every contributor build with the same compiler.
- Release profile as planned: `lto = "fat"`, `codegen-units = 1`, `strip = true`, `panic = "abort"`, and `opt-level` chosen by measuring `"z"` against `3` on the Phase 0 binary (the result is recorded here).
- Workspace lints: `clippy::unwrap_used` and `clippy::expect_used` denied outside tests, `clippy::too_many_lines` with a 50-line threshold in `clippy.toml`, `unsafe_code` forbidden.
- Dependency direction (transport, operations, domain, storage) is checked by a test that reads each crate's `Cargo.toml` and fails when a lower layer depends on a higher one (for example `sendmock-store` on `sendmock-api`).

## W2: Rust CI and test setup

- A `rust` job in `ci.yml` on `ubuntu-latest`, `macos-latest` and `windows-latest`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo nextest run`, with `Swatinem/rust-cache`.
- **Coverage:** `cargo llvm-cov nextest` on Linux, reported on the pull request, failing below 80% lines overall or 90% for `sendmock-ops` and the domain crates ([AGENTS.md](../../AGENTS.md#ci-enforcement)).
- **File size:** `scripts/check-file-lines.ts` (Bun, no new dependency) fails on a Rust source file over 500 lines and lists files over 300, excluding tests, generated code and fixtures. ESLint already does this for TypeScript.
- **Test fakes** in `sendmock-core`: the `Clock`, `IdGenerator` and `RandomSource` traits with system implementations and fixed fakes (`FixedClock`, `SequentialIdGenerator`, `SeededRandomSource`), so no test uses real time or randomness.
- **Snapshots:** `insta` (dev dependency) for CLI `--json` output and MCP tool definitions; snapshots are reviewed in the pull request, never auto-accepted in CI.
- The `rust` job and the coverage gate join the required status checks on `develop` and `main` (owner, in GitHub settings).

## W3: Config, tracing and graceful shutdown

- **Config** with `clap` (derive, env) and `toml`. Precedence: flags, then `SENDMOCK_*` env vars, then `sendmock.toml` (current directory, then the OS config directory), then defaults (PL-07.1). The merged config is one typed struct passed into the server, never read from globals.
- Phase 0 keys: `http_addr`, `smtp_addr` (validated, bound from Phase 1), `db`, `log_format`, `log_level`, `seed`. Later phases add their own keys.
- Unknown keys (`deny_unknown_fields`) and invalid values fail at startup with the file, key and expected value (PL-07.2).
- A port already in use fails with the address and the flag to change it: `Port 8025 is in use. Start SendMock with --http-addr 127.0.0.1:8125 or stop the other program.` (PL-07.3).
- The native binary binds `127.0.0.1` by default (PL-06.1, native half).
- **Tracing:** `tracing` and `tracing-subscriber`, human-readable by default and JSON with `SENDMOCK_LOG_FORMAT=json`.
- **Graceful shutdown:** `SIGTERM` and Ctrl-C stop accepting connections, let in-flight requests finish for up to 10 s, then exit `0`. Tested by starting the server in a test, sending the signal (Unix) or the Ctrl-C event (Windows), and checking the exit code and that an in-flight request completed.

## W4: SQLite store and migrations

As decided in [02](02-architecture.md#database-sqlite):

- `rusqlite` with `bundled` and FTS5. Connection pragmas: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`, `auto_vacuum = INCREMENTAL`.
- One writer task owns the only write connection; a small pool of read-only connections serves reads; blocking calls run on `spawn_blocking`.
- **Migrations:** embedded SQL files in `crates/sendmock-store/migrations/`, applied in order at startup, one transaction each, version in `PRAGMA user_version`. `0001_init.sql` creates the `settings` table only; each later phase adds its own tables.
- A database from a newer SendMock version is refused with a clear message; an on-disk database is copied to `sendmock.db.bak-<version>` before migrating.
- **Locations:** the OS data directory by default, `--db <path>` / `SENDMOCK_DB`, and `--db memory`.
- Tests: each opens its own temporary database; cases cover a fresh database, re-running migrations (no change), the backup file, refusing a newer database, and `--db memory`.

## W5: HTTP server, operation registry and embedded UI

- **Operation registry** (`sendmock-ops`): each operation is a command object with a typed input, a typed output, a handler, a description and flags (read-only, destructive, idempotent). Input and output types derive `serde` and `schemars`. Phase 0 registers two operations: `system.health` (`GET /api/v1/health`, answers `{ "status": "ok" }`) and `system.info` (`GET /api/v1/info`: version, channel, listeners, database path, size and mode), matching the shapes in `docs/api/openapi.yaml`.
- **REST adapter** (`sendmock-api`): `axum` and `tower-http`. Routes come from the registry, so a handler never holds business rules. Unknown `/api/...` paths answer `404` with the contract's error shape `{ "error": { "code", "message" } }`.
- **Embedded UI:** `rust-embed` includes `web/dist`. Any non-API path that is not a file returns `index.html` (SPA fallback), with long cache headers on hashed assets and `no-cache` on `index.html`. In debug builds files are read from disk, so UI changes need no Rust rebuild. A `build.rs` guard fails a release build with a clear message when `web/dist` is missing.
- **Mock mode in the binary:** in Phase 0 only, the binary embeds the mock-mode UI build, so every screen keeps working on fixtures as the done-when line says. From Phase 1 it embeds the live build only, and operations it does not serve yet show Not available yet (decided 2026-10-29, [07](07-ui.md#not-available-yet-stage-b), UI-12). The bundle budget (UI-06) measures the live build throughout.
- **Dev proxy:** `web/vite.config.ts` proxies `/api` and `/ws` to `http://127.0.0.1:8025` when `VITE_API_MODE=live`, so the UI can run against `cargo run` with hot reload.
- **Done-when smoke job** in `ci.yml` on all three operating systems: build the UI and the binary, start it, wait for `/api/v1/health`, fetch `/` and a deep link (`/mail`, the SPA fallback), stop it and check the exit code (DS-01.2 for the host build).

## W6: CLI skeleton, MCP tool definitions and parity check

- **CLI** (`sendmock-cli`), a client of a running instance over HTTP (`--server`, `SENDMOCK_SERVER`, default `http://127.0.0.1:8025`) using `reqwest` with rustls, the HTTP client the plan already uses for webhooks:
  - `sendmock status` (`system.info`) and `sendmock health` (`system.health`, exit `0` when healthy, the Docker HEALTHCHECK);
  - `sendmock version`, which prints the binary's own version and channel without a server (DS-01.3, ticked once releases publish checksums);
  - `sendmock help --all --json`, the whole command tree (AI-01.5).
- `--json` output is stable and snapshot tested, and is the default when stdout is not a terminal (`std::io::IsTerminal`, no crate) (AI-01.2).
- Exit codes `0` ok, `1` error, `2` usage, `3` not found, `4` timeout, `5` assertion failed, mapped from typed errors at the transport edge only (AI-01.3).
- **MCP** (`sendmock-mcp`): tool definitions (name, `inputSchema`, annotations) are generated from the registry by the rules in [21](21-reference-and-examples.md#2-one-rule-set-for-cli-flags-and-mcp-inputs); `system.health` and `system.info` share `sendmock_status` with the `view` selector, as the surface catalogue says. The stdio transport and `sendmock mcp` arrive in Phase 1 (AI-02); Phase 0 tests the generated definitions with snapshots.
- **Parity check** (AI-01.1): the binary prints its surfaces (`sendmock help --all --json` plus the MCP definitions), and `parity.yml` compares them with the surface catalogue (`web/src/lib/api/surface-catalogue/`): every registry operation must have a REST route, a CLI command and an MCP tool with the catalogue's names. Catalogue operations the binary does not have yet are listed as planned in the job summary, with the phase they arrive in, and do not fail the job.

## W7: Seed loader skeleton

- Parses `sendmock.seed.toml` into typed sections with source spans, so every error carries its line number.
- Phase 0 checks the parts every later phase relies on: TOML syntax, known top-level sections and keys, value types, `${ENV_VAR}` reference syntax, and that secret fields use an `${ENV_VAR}` reference instead of a literal. Each later phase adds the rules for its own item kinds.
- One operation, `seed.validate`, in every surface: `POST /api/v1/seed/validate` (answering `SeedValidation`: `is_valid`, `errors` with `line` and `message`, and the item counts per kind), `sendmock seed validate <file>` (exit `5` when invalid) and `sendmock_seed_validate`. It never changes anything (PL-04.5).
- The server loads a seed at startup (`--seed`, `./sendmock.seed.toml`, `/config/sendmock.seed.toml` in Docker) only far enough to validate it and refuses to start on errors; applying seeds comes in Phase 3.

## W8: OpenAPI contract tests

- `utoipa` describes the REST adapter, and the server serves the generated document at `/api/openapi.json` (PL-01.3).
- A contract test compares each operation the binary serves with the same operation in the frozen `docs/api/openapi.yaml`: path, method, parameters, request and response schemas. It fails when they differ, or when the binary serves an operation the frozen file does not have.
- Handler answers recorded in the integration tests are validated against the frozen file's schemas with `jsonschema` (dev dependency only).
- PL-01.1 (every endpoint exists and matches) stays open: each phase adds its endpoints to this test, and it is ticked when the last one lands.

## W9: Version script and changelog

As planned in [16](16-website-and-releases.md#versioning):

- `scripts/version.ts` (Bun, no new dependency) with `show`, `check`, `next <bump>`, `bump <bump>`, `changelog` and `notes <version>`. The version lives in the workspace `Cargo.toml` and is synced into every member `Cargo.toml`, `Cargo.lock`, `web/package.json` and `website/package.json` (DS-05.1).
- A `version` step in `ci.yml` runs `bun scripts/version.ts check` and fails when the files disagree (DS-05.2).
- `next` implements the bump table, including the refusals (DS-05.3).
- `changelog` builds the new section from the pull requests merged since the last tag, grouped as Breaking changes, Added and Fixed, skipping `docs:`, `test:`, `chore:`, `ci:` and `refactor:`, with a stable section collecting its betas (DS-05.4). The pull request list comes from the GitHub API in the workflow and from fixtures in the tests, so tests use no network.
- The website gains `/changelog/`, which renders `CHANGELOG.md` and says "No releases yet" until the first one. The app's What's new link keeps opening GitHub releases until then.

## W10: Release workflows

As planned in [16](16-website-and-releases.md#workflows). Each workflow is a thin YAML file that calls a tested Bun script in `scripts/release/`, so the decisions (which version, whether CI passed, whether a release is in progress) are unit tested with fixtures instead of only in live runs:

- `release-prepare.yml` (Prepare release): manual on `develop`, with `bump` and `dry_run`; checks CI passed on the commit and no release is in progress, writes the version and changelog, and opens `chore:[REL-N] release X.Y.Z[-beta.N]`.
- `beta-publish.yml`, `stable-promote.yml`, `stable-publish.yml`: run after CI on `develop` or `main` and act only when the version in the code calls for it; safe to re-run (DS-04.5).
- `release.yml`: builds the six targets ([09](09-distribution.md#targets), `cargo-zigbuild` for Linux), packs the archives and `SHA256SUMS` ([09](09-distribution.md#release-archives)), and runs the binary tests on each target's own runner before anything is published. Phase 0 runs the cases that exist so far (checksum and layout, version, start with no runtime, localhost-only listeners, health, embedded UI, a clean stop); Phase 1 adds the email cases and the data kept across a restart, Phase 2 the SMS case.
- Tests: no release from a commit where CI did not pass, the version in code, tag and pre-release flag must agree (DS-04.4), a stable is refused while its beta is unpublished or has untried changes on top (DS-04.2).
- Package channels (Homebrew, Scoop, npm, `.deb`, `.rpm`, install scripts) are added in Phase 1 and Phase 5 with DS-03.
- **Owner setup:** "Allow GitHub Actions to create and approve pull requests", and the release secrets listed in [16](16-website-and-releases.md#workflows) once the channels that need them land.

## W11: Dockerfile and `edge` image

As planned in [09](09-distribution.md#docker):

- `Dockerfile`: a build stage for the UI and the static musl binary, then `FROM scratch` with the binary, UID `10001`, `VOLUME /data`, `SENDMOCK_DB=/data/sendmock.db`, `0.0.0.0` listeners with the "no UI auth" notice (PL-06.1, Docker half), `EXPOSE` for the W0 ports, and `HEALTHCHECK CMD ["/sendmock", "health"]`.
- `docker-edge.yml`: on every push to `develop`, builds `linux/amd64` and `linux/arm64` with buildx, pushes `edge` to GHCR and Docker Hub, signs with cosign (keyless) and attaches the SBOM and provenance.
- Tests in the workflow before pushing: the image runs as non-root on both platforms with data in `/data` (DS-02.1), becomes healthy and stops cleanly on `SIGTERM` (DS-02.2), and is under 25 MB compressed (DS-02.5 with the signature and attestations).
- DS-02.3 (mounted config, seed and templates) is ticked when the seed and templates are applied (Phase 3); DS-02.4 when the beta and stable tags exist.
- **Owner setup:** a Docker Hub token as a repository secret.

## W12: README and licence

- `README.md` at the root: what SendMock is in two sentences, the screenshot from the landing page, install (a note that the first beta comes with Phase 1, and the `edge` image until then), the quick start, and links to the docs, the demo, `CONTRIBUTING.md` and `SECURITY.md`.
- The licence files from W0 (`LICENSE-MIT` and `LICENSE-APACHE` for the recommendation), which `release.yml` puts in every archive next to the readme.

## Criteria

Phase 0 builds the parts these criteria need and ticks the ones a Phase 0 test can prove. No feature reaches `Accepted` in Phase 0, because the Definition of Done needs a beta release ([acceptance README](acceptance/README.md#definition-of-done-applies-to-every-feature)); they move to `In progress`.

| Ticked in Phase 0 | Waits for |
|-------------------|-----------|
| PL-07.1, PL-07.2, PL-07.3 (W3) | |
| PL-06.1 (W3 and W11) | PL-06.2 to PL-06.4 with UI auth and the playground's Local mode (Phase 1) |
| PL-04.5 (W7) | PL-04.1 to PL-04.4 and PL-04.6 (Phase 3) |
| PL-01.3 (W8) | PL-01.1 when the last endpoint lands, PL-01.2 when the first paged list lands (Phase 1) |
| AI-01.1, AI-01.2, AI-01.3, AI-01.5 (W6) | AI-01.4 with the first destructive command (Phase 1) |
| DS-01.2 for the host build (W5) | DS-01.1, DS-01.3, DS-01.4 and DS-01.5 with the first beta (Phase 1) and every target (Phase 5) |
| DS-02.1, DS-02.2, DS-02.5 (W11) | DS-02.3 (Phase 3), DS-02.4 and DS-02.6 (Phase 1 and Phase 5) |
| DS-04.2, DS-04.4, DS-04.5 (W10) | DS-04.1 with the first beta (Phase 1), DS-04.3 with the first stable (Phase 5) |
| DS-05.1 to DS-05.4 (W9) | DS-05.5 with the first published release (Phase 1) |

DS-01.2 is ticked for the host build only if the owner agrees that the smoke job on three operating systems proves it; otherwise it waits for the release binaries in Phase 1. The Rust test setup, the workspace and the README have no criteria of their own: the [Testing](../../AGENTS.md#testing) and [Code style](../../AGENTS.md#code-style) rules in AGENTS.md are their definition of done.

## New dependencies

Every crate below is already in the tech stack in [02](02-architecture.md#tech-stack) unless marked new.

| Crate or tool | Used by | Why |
|---------------|---------|-----|
| `tokio`, `axum`, `tower-http` | W3, W5 | runtime and HTTP server |
| `clap`, `serde`, `serde_json`, `toml` | W3, W6, W7 | flags, env vars, config and seed files |
| `tracing`, `tracing-subscriber` | W3 | logs |
| `rusqlite` (bundled) | W4 | the database |
| `rust-embed` | W5 | the embedded UI |
| `utoipa`, `schemars` | W5, W8 | OpenAPI and shared schemas |
| `reqwest` (rustls) | W6 | the CLI's HTTP client |
| `ulid` | W2 | the `IdGenerator` |
| `thiserror` (new) | all | typed errors per layer, as [AGENTS.md](../../AGENTS.md#layers-and-dependency-direction) requires; no runtime cost |
| `dirs` (new) | W3, W4 | the OS config and data directories on three platforms; small, no dependencies of note |
| `insta`, `tempfile`, `jsonschema` (new, dev only) | W2, W4, W8 | snapshots, temporary databases, schema checks; not in the binary |
| `cargo-nextest`, `cargo-llvm-cov`, `cargo-zigbuild` (CI tools) | W2, W10 | test runner, coverage, Linux cross builds |

The binary size, idle memory and cold start budgets in [09](09-distribution.md#performance-budget-checked-in-ci-on-linux-x64) are measured from W5 on and recorded here, so later phases can see what each one adds.
