# 09. Build and Distribution

## Single binary

Release build steps (wrapped in `scripts/build.sh` and a `justfile` or `Makefile`):

1. `cd web && bun install --frozen-lockfile && bun run build` -> `web/dist`
2. `cargo build --release -p sendmock` -> `rust-embed` includes `web/dist`
3. Result: `target/release/sendmock` (or `sendmock.exe`)

In debug builds `rust-embed` reads files from disk, so UI changes do not require recompiling Rust. A `build.rs` guard fails release builds with a clear message if `web/dist` is missing.

## CLI shape

```
sendmock                       # same as `sendmock serve`
sendmock serve [flags]         # run servers
sendmock sendmail [...]        # sendmail-compatible shim
sendmock email|sms|otp|webhook|numbers|settings|chaos ...   # client commands for every feature
sendmock http ...              # HTTP catcher
sendmock seed export|apply     # config-as-code seed file
sendmock health                # exit 0 when the running instance is healthy (Docker HEALTHCHECK)
sendmock scenario run <file>   # scripted simulation
sendmock mcp                   # MCP server over stdio
sendmock ai install --target <harness>                      # register MCP + skill
sendmock version
```

The full command tree, `--json` conventions and exit codes are in [14-ai-integration.md](14-ai-integration.md).

Config precedence: flags > `SENDMOCK_*` env vars > `sendmock.toml` (current dir, then OS config dir) > defaults. Seed data (endpoints, rules, templates, numbers, ...) lives in a separate `sendmock.seed.toml`; see [02-architecture.md](02-architecture.md#configuration-and-seed-file).

## Targets

| OS | Arch | Target triple | Notes |
|----|------|---------------|-------|
| macOS | arm64 | `aarch64-apple-darwin` | |
| macOS | x64 | `x86_64-apple-darwin` | also ship a universal binary |
| Linux | x64 | `x86_64-unknown-linux-musl` | fully static |
| Linux | arm64 | `aarch64-unknown-linux-musl` | Raspberry Pi, Graviton |
| Windows | x64 | `x86_64-pc-windows-msvc` | |
| Windows | arm64 | `aarch64-pc-windows-msvc` | |

Static Linux binaries built natively in the `rust:1.98-alpine` image on x64 and arm64 runners (the same build as the Docker image; `cargo-zigbuild` cross builds idled about 10 MB higher, over the memory budget), and native GitHub Actions runners for macOS and Windows. Everything uses rustls (no OpenSSL) and bundled SQLite, so there are no system library dependencies.

### Release archives

Each GitHub release attaches one archive per target, named `sendmock-<target triple>` with `.tar.gz` for macOS and Linux and `.zip` for Windows (for example `sendmock-aarch64-apple-darwin.tar.gz`, `sendmock-x86_64-pc-windows-msvc.zip`), plus a `SHA256SUMS` file. Each archive holds the `sendmock` binary (`sendmock.exe` on Windows), the licence and the readme at its top level, with no folder inside, so the install page's unpack steps leave `sendmock` in the current folder. The names carry no version, so `https://github.com/shibbirweb/sendmock/releases/latest/download/<archive>` always gives the latest stable build; the website's quick start links these for readers who download by hand (decided 2026-10-27). GitHub's `latest` skips pre-releases, so each beta release also moves a rolling `beta` pre-release to the same archives: `https://github.com/shibbirweb/sendmock/releases/download/beta/<archive>` always gives the newest beta, and the install page links both.

### Binary tests on every platform (decided 2026-10-27)

Every target a release builds is tested on its own operating system and CPU before anything is published. `release.yml` runs one job per target on a matching GitHub runner, and a failure on any platform stops the release.

| Target | Runner |
|--------|--------|
| `aarch64-apple-darwin` | Apple silicon macOS runner |
| `x86_64-apple-darwin` | Intel macOS runner (`macos-15-intel` while GitHub offers one) |
| `x86_64-unknown-linux-musl` | `ubuntu-latest`, plus the `alpine` and `busybox` images |
| `aarch64-unknown-linux-musl` | `ubuntu-24.04-arm`, plus the `alpine` image |
| `x86_64-pc-windows-msvc` | `windows-latest` |
| `aarch64-pc-windows-msvc` | `windows-11-arm` |

Each job runs the same test cases against the archive the release will publish, following the install page's steps (`tar -xzf` or `Expand-Archive`), not a fresh build:

1. The archive's checksum matches `SHA256SUMS`, and it holds `sendmock`, the licence and the readme at its top level.
2. `sendmock --version` prints the release's version and channel.
3. `sendmock` starts with no runtime installed (on Linux also in `alpine` and `busybox`, which have no glibc; on Windows with no Visual C++ redistributable) and listens on `127.0.0.1:1025` and `127.0.0.1:8025` only.
4. `sendmock health` exits 0 once the listeners are ready.
5. `GET /` serves the embedded web UI and `GET /api/v1/health` answers.
6. An email sent over SMTP and an SMS sent through the API are read back through the API.
7. After a restart, the captured email is still there (the default data folder for that operating system).
8. Stopping it (`SIGTERM` on macOS and Linux, a console stop event on Windows) shuts down cleanly with exit code 0.
9. The install script for the platform (`install.sh` on macOS and Linux, `install.ps1` on Windows) installs the stable and, with the beta option, the beta, and `sendmock` is on the `PATH` of a new shell.

The test cases live in one Bun script (`scripts/release/installed-binary-checks.ts`, changed on 2026-11-06 from one script per shell, since every test job already runs Bun) so every platform runs the same list, and the Docker image and package channels reuse cases 2 to 8 through `scripts/release/check-installed.ts` ([DS-03.6](acceptance/07-distribution-website.md#ds-03-package-managers-and-install-scripts)).

## Release channels

Every channel has a **beta** track (from `develop`) and a **stable** track (from `main`); see [16-website-and-releases.md](16-website-and-releases.md#what-each-channel-publishes).

| Channel | Mechanism |
|---------|-----------|
| GitHub Releases | archives + SHA256 checksums, built by a tag-triggered workflow (consider `cargo-dist`) |
| Install scripts | `curl -fsSL .../install.sh \| sh`, `irm .../install.ps1 \| iex` |
| Homebrew | tap first (`brew install shibbirweb/tap/sendmock`), core later |
| Linux packages | `.deb` and `.rpm` on every GitHub release (`cargo-deb`, `cargo-generate-rpm`); later our own signed APT and YUM repository |
| Scoop / WinGet | manifest in a bucket repo, WinGet later |
| Chocolatey | community package, later |
| AUR, COPR, Nixpkgs | community packages for Arch, Fedora and Nix, later |
| Docker | `ghcr.io/shibbirweb/sendmock` and Docker Hub; multi-arch; see [Docker](#docker) |
| Cargo | `cargo install sendmock` (requires prebuilt UI in the crate package) |
| npm | the `sendmock` package runs the right binary for the computer, as a dev dependency in a JavaScript project or with no install at all through `npx sendmock` (added 2026-11-07, owner request; also `bunx`, `pnpm dlx` and `yarn dlx`) |

Optional later: a macOS menu-bar / system tray launcher.

### Package channels by stage (decided 2026-10-27)

Channels we run ourselves ship early; a distribution's official repository is run by that distribution's maintainers, takes months and needs an established project, so it comes last. Each channel is one more publish step in the release workflows ([16](16-website-and-releases.md#workflows)), with its token stored as a repository secret.

| Stage | Channel | Users run | Notes |
|-------|---------|-----------|-------|
| First beta (Phase 1) | GitHub Releases archives | download and unpack | macOS, Linux, Windows; checksums |
| | Install scripts | `curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh \| sh`, `irm https://github.com/shibbirweb/sendmock/releases/latest/download/install.ps1 \| iex` | attached to every release ([open question 13](10-open-questions.md#13-install-script-url-decided-2026-10-27-github-release-assets), decided) |
| | `.deb` and `.rpm` on each release | `sudo apt install ./sendmock_<version>_amd64.deb`, `sudo dnf install ./sendmock-<version>.x86_64.rpm` | built by `cargo-deb` and `cargo-generate-rpm` |
| | Homebrew tap | `brew install shibbirweb/tap/sendmock` | repository `shibbirweb/homebrew-tap`; macOS and Linux |
| | Scoop bucket | `scoop bucket add shibbirweb <bucket url>`, `scoop install sendmock` | repository `shibbirweb/scoop-bucket` |
| | Docker | `docker run ... ghcr.io/shibbirweb/sendmock` | see [Docker](#docker) |
| 1.0 stable (Phase 5) | Our own APT and YUM repository | add our signing key and repository once, then `sudo apt install sendmock` / `sudo dnf install sendmock` with normal upgrades | signed with our GPG key; hosted on GitHub Pages or a free open-source host (Cloudsmith, packagecloud); `stable` and `beta` components |
| | WinGet | `winget install shibbirweb.sendmock` | a PR to Microsoft's `winget-pkgs` per stable release, scripted from the workflow (`wingetcreate`); built into Windows 10 and 11 |
| | Chocolatey | `choco install sendmock` | each version waits in human moderation (often days), so it lags the release |
| | AUR | `yay -S sendmock-bin` | `sendmock-bin` and `sendmock-beta-bin`, from the release archives |
| | COPR | `sudo dnf copr enable shibbirweb/sendmock`, `sudo dnf install sendmock` | Fedora's personal repositories |
| | Nixpkgs | `nix-env -iA nixpkgs.sendmock` | a PR to `nixpkgs`; the update bot follows new releases |
| | npm wrapper, `cargo install` | as in the table above | |
| | npx, with no install | `npx sendmock` (stable), `npx sendmock@beta`, or `bunx sendmock`, `pnpm dlx sendmock`, `yarn dlx sendmock` | the npm package, fetched into the package manager's cache on first run; added 2026-11-07 (owner request), DS-03.7 |
| Optional | Snap Store | `sudo snap install sendmock` | cross-distribution, reviewed by Canonical; only if users ask |
| | Ubuntu PPA | `sudo add-apt-repository ppa:shibbirweb/sendmock` | Launchpad builds from source with vendored crates; our APT repository covers the same need |
| With traction | Homebrew core | `brew install sendmock` | needs a well-known project with stable releases that build from source; tap users keep working |
| | Debian (then Ubuntu), Fedora, Arch official repositories | `sudo apt install sendmock` with no setup | needs a Debian sponsor or a Fedora packager or an Arch package maintainer, and every Rust dependency packaged by the distribution; Ubuntu takes Debian's package |

Before any official repository will take SendMock it needs an OSI licence (the Phase 0 README and licence item), a history of stable releases, and users. Windows code signing is optional: it removes SmartScreen's "unknown publisher" warning, and neither WinGet nor Chocolatey requires it.

The landing page's quick start has a tab per platform: Homebrew (macOS), `install.ps1` (Windows) and `install.sh` (Linux), the scripts served from the latest GitHub release; each tab then starts `sendmock`. When our APT repository and WinGet exist, the Linux and Windows tabs can switch to `apt install` and `winget install`.

## Docker

Docker is a first-class release channel, not an afterthought: many teams run their whole dev stack in Compose and CI services.

### Image

| Item | Decision |
|------|----------|
| Registries | `ghcr.io/shibbirweb/sendmock` and Docker Hub `shibbirweb/sendmock` (https://hub.docker.com/r/shibbirweb/sendmock); the install page uses GHCR in its commands and links the Docker Hub page |
| Platforms | `linux/amd64`, `linux/arm64` (Apple Silicon, Graviton, Raspberry Pi 4/5); `linux/arm/v7` if demand |
| Base | `FROM scratch` with the static musl binary, CA certificates bundled (rustls + `webpki-roots`, so outbound HTTPS for webhooks, link check and relay works without OS packages) |
| Size target | under 25 MB compressed |
| User | runs as non-root (UID 10001) |
| Data | `VOLUME /data` (SQLite DB, generated TLS certs); `SENDMOCK_DB=/data/sendmock.db` by default |
| Config | everything via `SENDMOCK_*` env vars; optional `/config/sendmock.toml` and `/config/sendmock.seed.toml` auto-loaded if mounted; `/templates` auto-loaded as `--templates-dir` |
| Listen | binds `0.0.0.0` inside the container by default (the localhost-only default applies to the native binary) |
| Ports | `1025` SMTP, `8025` UI/API/MCP, `8026` provider APIs (when `SENDMOCK_PROVIDER_ADDR` set), `8030` HTTP catcher port (when enabled), `1465` implicit TLS SMTP (when enabled) |
| Healthcheck | `HEALTHCHECK CMD ["/sendmock", "health"]` (a built-in subcommand, since `scratch` has no curl) |
| Signals | graceful shutdown on `SIGTERM` (finishes in-flight SMTP sessions and webhook attempts, up to 10 s) |
| Logs | structured to stdout; `SENDMOCK_LOG_FORMAT=json` for log collectors |
| Metadata | OCI labels (version, source, licence), SBOM and provenance attestations, images signed with cosign |

### Tags

Stable (from `main`): `latest`, `1`, `1.4`, `1.4.2`. Beta (from `develop`): `beta`, `1.5.0-beta.2`. No `edge` tag: images are published only by a release (owner decision, 2026-11-08; until then every push to `develop` published `edge`). Pushes to `develop` and pull requests build and test the image, and rehearse the signing and SBOM check on a registry on the runner, without publishing. Plus `-debug` variants based on `distroless/static:debug` with a shell for troubleshooting.

### Usage

```bash
docker run -d --name sendmock \
  -p 8025:8025 -p 1025:1025 \
  -v sendmock-data:/data \
  ghcr.io/shibbirweb/sendmock:1
```

Compose example (with seed file, provider port and healthcheck dependency) is in [08-integrations.md](08-integrations.md#docker-compose).

CI service container (GitHub Actions):

```yaml
services:
  sendmock:
    image: ghcr.io/shibbirweb/sendmock:1
    ports:
      - 1025:1025
      - 8025:8025
    env:
      SENDMOCK_DB: memory
```

### Docker-specific UX

- When running in a container, the UI's connection snippets show container-network hostnames (`sendmock:1025`) alongside host ones (`localhost:1025`).
- Webhook endpoint editor warns when a URL uses `localhost` inside a container and suggests `host.docker.internal` or the Compose service name.
- Binding to `0.0.0.0` without `SENDMOCK_UI_AUTH` prints a startup notice (not an error, since published ports are usually only on the dev machine).

### Later

Helm chart for shared team instances in Kubernetes, and a Docker Desktop extension.

## Test suite integration

- `sendmock serve --smtp-addr 127.0.0.1:0 --http-addr 127.0.0.1:0 --ready-json`: binds free ports and prints a single JSON line with the chosen addresses once ready (see [08-integrations.md](08-integrations.md#starting-sendmock-from-a-test-suite)).
- **Testcontainers modules** for Java, Node, Go, Python and .NET wrapping the Docker image, with helpers for ports, seed files and the wait/OTP API (Phase 5).

## CI pipeline

On every PR:

- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (Linux, macOS, Windows).
- `bun run lint`, `bun run typecheck`, `bun test`.
- Integration tests: start the binary, send email via SMTP clients in several languages (Docker matrix), send SMS via native and provider endpoints, assert via API.
- Size check: fail if the release binary grows past the budget (e.g. 20 MB) without an explicit override.
- Contract (OpenAPI) and parity (REST + CLI + MCP per operation) checks, CLI/MCP snapshot tests, Playwright end-to-end tests, website build and link check.
- Coverage report on the pull request (`cargo llvm-cov`, Vitest coverage): at least 80% overall and 90% for domain and operations code, and no decrease. The full test policy is in [AGENTS.md](../../AGENTS.md#testing).

### Test builds of every pull request (planned 2026-11-14, owner request, DS-11)

Anyone reviewing or testing a change can download the binary for their computer and try it before the change is merged or released ([#245](https://github.com/shibbirweb/sendmock/issues/245), W25 in [30](30-phase-5.md#workstreams-and-order)). Until now the only binaries are release archives; CI's smoke test builds three, keeps only the Linux one, for a day, for the next job.

- **When:** every pull request, into any branch, and every push to `develop` and `main`. Docs-only pull requests get builds too (owner request: every pull request). A newer push to the same pull request cancels the older run.
- **What:** `.github/workflows/test-builds.yml`, "Test builds", calls the release build (`release.yml` through `workflow_call`) with `publish: false`, the `dev` channel, the commit and the version in the code. So a test build is what a release would ship: the six [targets](#targets), the web UI embedded, each archive tested on its own operating system and CPU with the same [test cases](#binary-tests-on-every-platform-decided-2026-10-27). The install script case tests published releases, not this build, so a test build may skip it. Nothing is published: no release, tag, package or image.
- **Artifacts:** one per target, named like the [release archives](#release-archives) (`sendmock-<target triple>`), holding the archive and its `.sha256` file. GitHub wraps each artifact in a `.zip` when it is downloaded. An archive is uploaded only after its tests pass. Kept 14 days for pull requests and 30 days for `develop` and `main` (GitHub allows at most 90).
- **Links:** the run summary lists every target with its archive name, size, SHA-256 and download link. On a pull request from this repository, one comment (found by a hidden marker and updated on every push, never posted twice) lists the same links with the commit they were built from. A pull request from a fork gets the summary only, since its token cannot comment.
- **Who can download:** GitHub serves workflow artifacts only to signed-in users (any GitHub account, for a public repository), from the run page or with `gh run download <run id> -n sendmock-<target triple>`. The binaries are unsigned like the release archives, so macOS needs the install page's quarantine step.
- **Version:** `sendmock version` reports the version in the code and the `dev` channel, so a test build is never taken for a release; the summary and the comment name the commit.
- **Cost:** about twelve runner jobs per run (six builds, six tests), including the macOS and Windows ARM runners. CI's binary smoke test stays as it is.
- **Docs:** the install page gets "Try a build that is not released yet", as numbered steps: open the pull request's comment or the run, download the archive for your computer, check its SHA-256, unpack it and run it.
- **Proof:** `scripts/test-builds-workflow.test.ts` reads the workflow (its triggers, the release build call with publishing off, the artifact names and retention, the comment step skipped for forks, the concurrency group); the comment and summary text come from one Bun script with its own tests; the first run on the pull request that builds it is the end-to-end check.

Releases are cut by workflows (`beta.yml`, `beta-publish.yml`, `stable.yml`, `stable-promote.yml`, `stable-publish.yml`, `release.yml`), never by hand; see [16-website-and-releases.md](16-website-and-releases.md#workflows). The release build:

- Build all targets, generate checksums, publish GitHub Release, build and push multi-arch Docker images (buildx) with SBOM and cosign signature, bump Homebrew/Scoop manifests.
- Smoke test the published image: `docker run` it, send an email via SMTP and an SMS via API, check `/api/v1/health`.

## Performance budget (checked in CI on Linux x64)

| Metric | Target |
|--------|--------|
| Binary size | under 20 MB (stretch: under 12 MB) |
| Embedded web UI (`dist/` without source maps) | under 2.25 MB (UI-06.3) |
| Idle RSS | under 30 MB |
| Cold start to listening | under 200 ms |
| SMTP ingest | 500+ small messages/s on a laptop |
| Docker image | under 25 MB compressed |

## Versioning

SemVer with `-beta.N` pre-releases. `0.x` while the API settles; `1.0` freezes `/api/v1`, CLI flags and native webhook format. The Prepare release workflow works out the version from its `bump` choice and writes the `CHANGELOG.md` section from the merged pull request titles; that section is the release notes ([16](16-website-and-releases.md#versioning)).
