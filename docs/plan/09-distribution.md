# 09. Build and Distribution

## Single binary

Release build steps (wrapped in `scripts/build.sh` and a `justfile` or `Makefile`):

1. `cd web && bun install --frozen-lockfile && bun run build` -> `web/dist`
2. `cargo build --release -p messagehook` -> `rust-embed` includes `web/dist`
3. Result: `target/release/messagehook` (or `messagehook.exe`)

In debug builds `rust-embed` reads files from disk, so UI changes do not require recompiling Rust. A `build.rs` guard fails release builds with a clear message if `web/dist` is missing.

## CLI shape

```
messagehook                       # same as `messagehook serve`
messagehook serve [flags]         # run servers
messagehook sendmail [...]        # sendmail-compatible shim
messagehook email|sms|otp|webhook|numbers|settings|chaos ...   # client commands for every feature
messagehook http ...              # HTTP catcher
messagehook seed export|apply     # config-as-code seed file
messagehook health                # exit 0 when the running instance is healthy (Docker HEALTHCHECK)
messagehook scenario run <file>   # scripted simulation
messagehook mcp                   # MCP server over stdio
messagehook ai install --target <harness>                      # register MCP + skill
messagehook version
```

The full command tree, `--json` conventions and exit codes are in [14-ai-integration.md](14-ai-integration.md).

Config precedence: flags > `MESSAGEHOOK_*` env vars > `messagehook.toml` (current dir, then OS config dir) > defaults. Seed data (endpoints, rules, templates, numbers, ...) lives in a separate `messagehook.seed.toml`; see [02-architecture.md](02-architecture.md#configuration-and-seed-file).

## Targets

| OS | Arch | Target triple | Notes |
|----|------|---------------|-------|
| macOS | arm64 | `aarch64-apple-darwin` | |
| macOS | x64 | `x86_64-apple-darwin` | also ship a universal binary |
| Linux | x64 | `x86_64-unknown-linux-musl` | fully static |
| Linux | arm64 | `aarch64-unknown-linux-musl` | Raspberry Pi, Graviton |
| Windows | x64 | `x86_64-pc-windows-msvc` | |
| Windows | arm64 | `aarch64-pc-windows-msvc` | |

Cross-compilation via `cargo-zigbuild` for Linux targets and native GitHub Actions runners for macOS and Windows. Everything uses rustls (no OpenSSL) and bundled SQLite, so there are no system library dependencies.

## Release channels

Every channel has a **beta** track (from `develop`) and a **stable** track (from `main`); see [16-website-and-releases.md](16-website-and-releases.md#what-each-channel-publishes).

| Channel | Mechanism |
|---------|-----------|
| GitHub Releases | archives + SHA256 checksums, built by a tag-triggered workflow (consider `cargo-dist`) |
| Install scripts | `curl -fsSL .../install.sh \| sh`, `irm .../install.ps1 \| iex` |
| Homebrew | tap first (`brew install <owner>/tap/messagehook`), core later |
| Scoop / WinGet | manifest in a bucket repo, WinGet later |
| Docker | `ghcr.io/<owner>/messagehook` and Docker Hub; multi-arch; see [Docker](#docker) |
| Cargo | `cargo install messagehook` (requires prebuilt UI in the crate package) |
| npm (optional) | `npx messagehook` wrapper that downloads the right binary, handy for JS projects and CI |

Optional later: a macOS menu-bar / system tray launcher.

## Docker

Docker is a first-class release channel, not an afterthought: many teams run their whole dev stack in Compose and CI services.

### Image

| Item | Decision |
|------|----------|
| Registries | `ghcr.io/<owner>/messagehook` and Docker Hub `<owner>/messagehook` |
| Platforms | `linux/amd64`, `linux/arm64` (Apple Silicon, Graviton, Raspberry Pi 4/5); `linux/arm/v7` if demand |
| Base | `FROM scratch` with the static musl binary, CA certificates bundled (rustls + `webpki-roots`, so outbound HTTPS for webhooks, link check and relay works without OS packages) |
| Size target | under 25 MB compressed |
| User | runs as non-root (UID 10001) |
| Data | `VOLUME /data` (SQLite DB, generated TLS certs); `MESSAGEHOOK_DB=/data/messagehook.db` by default |
| Config | everything via `MESSAGEHOOK_*` env vars; optional `/config/messagehook.toml` and `/config/messagehook.seed.toml` auto-loaded if mounted; `/templates` auto-loaded as `--templates-dir` |
| Listen | binds `0.0.0.0` inside the container by default (the localhost-only default applies to the native binary) |
| Ports | `1025` SMTP, `8025` UI/API/MCP, `8026` provider APIs (when `MESSAGEHOOK_PROVIDER_ADDR` set), `8030` HTTP catcher port (when enabled), `1465` implicit TLS SMTP (when enabled) |
| Healthcheck | `HEALTHCHECK CMD ["/messagehook", "health"]` (a built-in subcommand, since `scratch` has no curl) |
| Signals | graceful shutdown on `SIGTERM` (finishes in-flight SMTP sessions and webhook attempts, up to 10 s) |
| Logs | structured to stdout; `MESSAGEHOOK_LOG_FORMAT=json` for log collectors |
| Metadata | OCI labels (version, source, licence), SBOM and provenance attestations, images signed with cosign |

### Tags

Stable (from `main`): `latest`, `1`, `1.4`, `1.4.2`. Beta (from `develop`): `beta`, `1.5.0-beta.2`. `edge`: every push to `develop`. Plus `-debug` variants based on `distroless/static:debug` with a shell for troubleshooting.

### Usage

```bash
docker run -d --name messagehook \
  -p 8025:8025 -p 1025:1025 \
  -v messagehook-data:/data \
  ghcr.io/<owner>/messagehook:1
```

Compose example (with seed file, provider port and healthcheck dependency) is in [08-integrations.md](08-integrations.md#docker-compose).

CI service container (GitHub Actions):

```yaml
services:
  messagehook:
    image: ghcr.io/<owner>/messagehook:1
    ports:
      - 1025:1025
      - 8025:8025
    env:
      MESSAGEHOOK_DB: memory
```

### Docker-specific UX

- When running in a container, the UI's connection snippets show container-network hostnames (`messagehook:1025`) alongside host ones (`localhost:1025`).
- Webhook endpoint editor warns when a URL uses `localhost` inside a container and suggests `host.docker.internal` or the Compose service name.
- Binding to `0.0.0.0` without `MESSAGEHOOK_UI_AUTH` prints a startup notice (not an error, since published ports are usually only on the dev machine).

### Later

Helm chart for shared team instances in Kubernetes, and a Docker Desktop extension.

## Test suite integration

- `messagehook serve --smtp-addr 127.0.0.1:0 --http-addr 127.0.0.1:0 --ready-json`: binds free ports and prints a single JSON line with the chosen addresses once ready (see [08-integrations.md](08-integrations.md#starting-messagehook-from-a-test-suite)).
- **Testcontainers modules** for Java, Node, Go, Python and .NET wrapping the Docker image, with helpers for ports, seed files and the wait/OTP API (Phase 5).

## CI pipeline

On every PR:

- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (Linux, macOS, Windows).
- `bun run lint`, `bun run typecheck`, `bun test`.
- Integration tests: start the binary, send email via SMTP clients in several languages (Docker matrix), send SMS via native and provider endpoints, assert via API.
- Size check: fail if the release binary grows past the budget (e.g. 20 MB) without an explicit override.
- Contract (OpenAPI) and parity (REST + CLI + MCP per operation) checks, CLI/MCP snapshot tests, Playwright end-to-end tests, website build and link check.
- Coverage report on the pull request (`cargo llvm-cov`, Vitest coverage): at least 80% overall and 90% for domain and operations code, and no decrease. The full test policy is in [AGENTS.md](../../AGENTS.md#testing).

Releases are cut by workflows (`beta.yml`, `beta-publish.yml`, `stable.yml`, `stable-promote.yml`, `stable-publish.yml`, `release.yml`), never by hand; see [16-website-and-releases.md](16-website-and-releases.md#workflows). The release build:

- Build all targets, generate checksums, publish GitHub Release, build and push multi-arch Docker images (buildx) with SBOM and cosign signature, bump Homebrew/Scoop manifests.
- Smoke test the published image: `docker run` it, send an email via SMTP and an SMS via API, check `/api/v1/health`.

## Performance budget (checked in CI on Linux x64)

| Metric | Target |
|--------|--------|
| Binary size | under 20 MB (stretch: under 12 MB) |
| Idle RSS | under 30 MB |
| Cold start to listening | under 200 ms |
| SMTP ingest | 500+ small messages/s on a laptop |
| Docker image | under 25 MB compressed |

## Versioning

SemVer with `-beta.N` pre-releases. `0.x` while the API settles; `1.0` freezes `/api/v1`, CLI flags and native webhook format. `CHANGELOG.md` `[Unreleased]` section becomes the release notes; `scripts/version.ts` works out and syncs the version.
