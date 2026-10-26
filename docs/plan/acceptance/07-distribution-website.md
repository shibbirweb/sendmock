# Acceptance: Distribution and releases (DS) and Website (WS)

Plan: [09-distribution.md](../09-distribution.md), [16-website-and-releases.md](../16-website-and-releases.md). Rules for IDs, ticking and tests: [README.md](README.md).

## DS-01 Single binary

Phase 0 (build), Phase 5 (all targets).

- [ ] DS-01.1 Release binaries build for macOS arm64/x64, Linux x64/arm64 (static musl) and Windows x64/arm64.
- [ ] DS-01.2 Each binary starts with no runtime or system libraries installed and serves the embedded UI.
- [ ] DS-01.3 `sendmock version` prints version and channel; checksums are published with every release.

## DS-02 Docker image

Phase 0 (`edge`), Phase 1 (`beta`), Phase 5 (stable tags, hardening).

- [ ] DS-02.1 The image runs on `linux/amd64` and `linux/arm64` as a non-root user, with data in `/data`.
- [ ] DS-02.2 The HEALTHCHECK (`sendmock health`) reports healthy once listeners are ready; `SIGTERM` shuts down gracefully.
- [ ] DS-02.3 Mounted `/config/sendmock.toml`, `/config/sendmock.seed.toml` and `/templates` are loaded.
- [ ] DS-02.4 Tags follow the channel rules: `edge`, `beta`, `X.Y.Z-beta.N` from `develop`; `latest`, `X`, `X.Y`, `X.Y.Z` from `main`.
- [ ] DS-02.5 Images are signed (cosign) and carry an SBOM and provenance; the compressed size is under 25 MB.
- [ ] DS-02.6 The Compose example and the GitHub Actions service-container example work as documented.

## DS-03 Package managers and install scripts

Phase 1 (beta Homebrew), Phase 5 (all).

- [ ] DS-03.1 Homebrew (`sendmock`, `sendmock-beta`), Scoop (`sendmock`, `sendmock-beta`), npm (`latest`, `beta` dist-tags) and `cargo install` (stable only) install a working binary.
- [ ] DS-03.2 `install.sh` and `install.ps1` install the stable by default and the beta with `--channel beta`, verifying checksums.

## DS-04 Release workflows

Phase 0.

- [ ] DS-04.1 Beta release opens a release PR with the next beta version and notes from `[Unreleased]`; merging it publishes a GitHub pre-release and builds all channels' beta artefacts.
- [ ] DS-04.2 Stable release refuses unless the current beta is published and nothing untried landed after it.
- [ ] DS-04.3 Promote stable opens the `develop` to `main` PR; merging it publishes the stable release and all stable channels.
- [ ] DS-04.4 No release is cut from a commit where CI did not pass; the version in code, tag and pre-release flag always agree.
- [ ] DS-04.5 Every workflow supports dry run (where documented) and can be re-run safely.

## DS-05 Version management

Phase 0.

- [ ] DS-05.1 `scripts/version.ts` computes the next version from tags and commits and syncs it into every file that carries it.
- [ ] DS-05.2 CI fails when version files disagree.

## DS-06 Test harness integration

Phase 1 (`--ready-json`), Phase 5 (Testcontainers).

- [ ] DS-06.1 Testcontainers modules for Java, Node, Go, Python and .NET start the image and expose SMTP, HTTP and provider URLs.
- [ ] DS-06.2 Each module's example test passes in CI.

## DS-07 Performance budgets

Phase 5 (enforced in CI).

- [ ] DS-07.1 Release binary under 20 MB, idle memory under 30 MB, cold start under 200 ms, SMTP ingest 500+ small messages/s on the CI benchmark machine.
- [ ] DS-07.2 CI fails when a budget is exceeded without an explicit override.

---

## WS-01 Site and deployment

Phase U0.

- [ ] WS-01.1 `website.yml` builds on pull requests and deploys to GitHub Pages from `main` and `develop`.
- [ ] WS-01.2 `/demo/` serves the mock-mode app and every screen works there.

## WS-02 Landing page

Phase U3.

- [ ] WS-02.1 The landing page uses Magic UI components for the hero, flow (animated beam), quick start (terminal), marquee, bento grid and number ticker.
- [ ] WS-02.2 With reduced motion on, all animations are static and the page stays readable.
- [ ] WS-02.3 Lighthouse scores are at least 90 for performance, accessibility, best practices and SEO.

## WS-03 Docs and versions

Phase 0 (`/next/`), Phase 5 (complete, versioned).

- [ ] WS-03.1 `/` serves the latest stable docs, `/next/` the `develop` docs with a beta banner, `/vX.Y/` older minors, with a working version switcher.
- [ ] WS-03.2 Generated references (CLI, MCP tools, templates, filters, magic numbers, config flags) match the code; CI fails on drift.
- [ ] WS-03.3 The link checker finds no broken internal links; search works on the static site.

## WS-04 API playground: Demo mode

Phase U3.

- [ ] WS-04.1 Every endpoint in the OpenAPI spec can be called from the playground and is answered by the in-browser mock.
- [ ] WS-04.2 Code snippets in cURL, PHP, JavaScript, Python, Go, Java, Rust, Ruby and C# stay in sync with the form and run successfully against a real instance (CI).
- [ ] WS-04.3 The event stream panel shows events triggered by requests; scenario mode runs multi-step flows.

## WS-05 API playground: Local mode

Phase 1.

- [ ] WS-05.1 After clicking Connect, requests reach a local SendMock at the configured URL and responses display.
- [ ] WS-05.2 Nothing is sent to a local instance until the user clicks Connect.
- [ ] WS-05.3 Connection errors (not running, CORS disabled, local network permission denied) show a clear explanation.

## WS-06 User guide

Phase U3 (W13). Plan: [19-user-guide.md](../19-user-guide.md).

- [ ] WS-06.1 Every sidebar item and every Settings section has a guide page with the template headings (What it solves, How it connects, Use it, Everything on this screen, Customize, From the CLI, API and AI); the test reads the list from `navigation-items.ts` and `settings-sections.ts`, so a new menu without a page fails CI.
- [ ] WS-06.2 Every menu page shows its screenshot, produced by `bun run screenshots`.
- [ ] WS-06.3 The connection map and the problem index link to every menu page, and every recipe and Advanced page is linked from at least one menu page.
- [ ] WS-06.4 The UI steps of the recipes and the Advanced walkthroughs (gateway, method, flow, template, catcher response, inbound route, outcome rules) are followed by Playwright tests in the demo, so a renamed button fails CI.
- [ ] WS-06.5 Every CLI command and MCP tool named in the user guide runs an operation in the surface catalogue (changed 2026-10-26: the catalogue from [20](../20-surface-parity.md) names every command and tool already in Stage A, so the check no longer waits for the Phase 0 reference).
