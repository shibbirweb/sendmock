# Acceptance: Distribution and releases (DS) and Website (WS)

Plan: [09-distribution.md](../09-distribution.md), [16-website-and-releases.md](../16-website-and-releases.md). Rules for IDs, ticking and tests: [README.md](README.md).

## DS-01 Single binary

Phase 0 (build), Phase 5 (all targets).

- [ ] DS-01.1 Release binaries build for macOS arm64/x64, Linux x64/arm64 (static musl) and Windows x64/arm64.
- [ ] DS-01.2 Each binary starts with no runtime or system libraries installed and serves the embedded UI.
- [ ] DS-01.3 `sendmock version` prints version and channel; checksums are published with every release.
- [ ] DS-01.4 Before publishing, the release workflow tests each target's archive on a runner of that operating system and CPU (macOS arm64 and x64, Linux x64 and arm64, Windows x64 and arm64) with the same test cases: checksum and archive layout, version, start with no runtime (Linux also in `alpine` and `busybox`), localhost-only listeners, health, embedded UI, an email and an SMS read back through the API, data kept across a restart, and a clean stop; a failure on any platform stops the release ([09](../09-distribution.md#binary-tests-on-every-platform-decided-2026-10-27)).
- [ ] DS-01.5 On each platform the install page's steps work as written: the unpack commands, the `PATH` step and the platform's install script (stable and beta) leave a working `sendmock` on the `PATH` of a new shell.

## DS-02 Docker image

Phase 0 (`edge`), Phase 1 (`beta`), Phase 5 (stable tags, hardening).

- [ ] DS-02.1 The image runs on `linux/amd64` and `linux/arm64` as a non-root user, with data in `/data`.
- [ ] DS-02.2 The HEALTHCHECK (`sendmock health`) reports healthy once listeners are ready; `SIGTERM` shuts down gracefully.
- [ ] DS-02.3 Mounted `/config/sendmock.toml`, `/config/sendmock.seed.toml` and `/templates` are loaded.
- [ ] DS-02.4 Tags follow the channel rules: `edge`, `beta`, `X.Y.Z-beta.N` from `develop`; `latest`, `X`, `X.Y`, `X.Y.Z` from `main`.
- [ ] DS-02.5 Images are signed (cosign) and carry an SBOM and provenance; the compressed size is under 25 MB.
- [ ] DS-02.6 The Compose example and the GitHub Actions service-container example work as documented.

## DS-03 Package managers and install scripts

Phase 1 (beta Homebrew, release `.deb` and `.rpm`), Phase 5 (all, including our APT and YUM repository, WinGet, Chocolatey, AUR, COPR and Nixpkgs). Official distribution repositories are later and have no criteria yet ([09](../09-distribution.md#package-channels-by-stage-decided-2026-10-27)).

- [ ] DS-03.1 Homebrew (`sendmock`, `sendmock-beta`), Scoop (`sendmock`, `sendmock-beta`), npm (`latest`, `beta` dist-tags) and `cargo install` (stable only) install a working binary.
- [ ] DS-03.2 `install.sh` and `install.ps1` install the stable by default and the beta with `--channel beta`, verifying checksums.
- [ ] DS-03.3 Every release attaches `.deb` and `.rpm` packages that install a working `sendmock` with `apt install ./...` and `dnf install ./...` (Phase 1); from 1.0 our signed APT and YUM repository serves them, with `stable` and `beta` components, and `apt install sendmock` / `dnf install sendmock` upgrade normally.
- [ ] DS-03.4 From 1.0 each stable release is submitted to WinGet (`shibbirweb.sendmock`) and Chocolatey (`sendmock`) by the release workflow, and both install a working binary.
- [ ] DS-03.5 From 1.0 the AUR (`sendmock-bin`, `sendmock-beta-bin`), COPR and Nixpkgs packages follow each release and install a working binary.
- [ ] DS-03.6 Every channel in [09](../09-distribution.md#package-channels-by-stage-decided-2026-10-27) that SendMock ships on is listed with its install command on the install page and checked by a smoke test in the release workflow.

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
- [ ] DS-05.3 The Prepare release workflow takes `bump` (`beta`, `patch`, `minor`, `major`, `stable`) and `dry_run`, works out the version as the table in plan 16 says, and refuses a version that is not newer than the one in progress or a `stable` with untried changes on top of its beta.
- [ ] DS-05.4 `CHANGELOG.md` is written only by the Prepare release workflow: one new section per release from the pull requests merged since the last tag, grouped into Breaking changes, Added and Fixed, each line the title without prefix and ticket with its PR linked; `docs:`, `test:`, `chore:`, `ci:` and `refactor:` pull requests are left out, and a stable section collects its betas.
- [ ] DS-05.5 Every GitHub release and pre-release body is its `CHANGELOG.md` section word for word.

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
- [ ] WS-02.4 The landing page has a promotional video section above the footer: a product poster in the current theme, three benefit points (no real messages sent, seconds instead of minutes, one setting), and a play button that is disabled with "Video coming soon" until the video exists; once it exists, pressing play loads the player (no autoplay and no third-party request before that) with captions ([16](../16-website-and-releases.md#promotional-video-decided-2026-10-27)).

## WS-03 Docs and versions

U3 W17 (versioned builds, switcher and banner, moved from Phase 0 on 2026-10-27, owner feedback F14), Phase 5 (complete, versioned).

- [ ] WS-03.1 `/` serves the latest stable docs, `/next/` the `develop` docs with a beta banner, `/vX.Y/` older minors, with a working version switcher.
- [ ] WS-03.2 Generated references (CLI, MCP tools, templates, filters, magic numbers, config flags) match the code; CI fails on drift.
- [ ] WS-03.3 The link checker finds no broken internal links; search works on the static site.
- [ ] WS-03.4 The version list is worked out from the git tags: the newest stable tag of the newest minor at `/`, the newest tag of each older minor at `/vX.Y/`, `develop` at `/next/`; beta tags get no docs of their own; with no stable tag yet, `/` is a Preview built from `develop`.
- [ ] WS-03.5 A tagged version is built from that tag's `docs/wiki`, `docs/api` and `web/` (its own demo) with the current website code, without changing the working tree.
- [ ] WS-03.6 The docs sidebar has a version switcher listing every version with the current one marked; picking a version opens the same page in that version.
- [ ] WS-03.7 Every page of a non-stable version (Beta, Preview, older) shows its banner with a link to the latest stable docs when one exists, and the demo of each version links its guide and Help links to the docs of the same version.

## WS-04 API playground: Demo mode

Phase U3.

- [ ] WS-04.1 Every endpoint in the OpenAPI spec can be called from the playground and is answered by the in-browser mock.
- [ ] WS-04.2 Code snippets in cURL, PHP, JavaScript, Python, Go, Java, Rust, Ruby and C# stay in sync with the form and run successfully against a real instance (CI).
- [ ] WS-04.3 The event stream panel shows events triggered by requests; scenario mode runs multi-step flows.
- [ ] WS-04.4 When an operation is picked, the playground shows every input it accepts in an Inputs panel: path and query parameters and every body field (nested fields included) with type, required, allowed values, default, description and example; an operation without a body says so (added 2026-10-26, [21](../21-reference-and-examples.md#4-playground-show-every-input)).
- [ ] WS-04.5 The body starts as a full example (required and optional fields with their example values); each field can be added to or removed from the body from the Inputs panel, Reset to example restores it, query parameters with allowed values are dropdowns, booleans are switches, and an unknown field, a missing required field or a value outside the allowed ones is pointed out before sending.
- [ ] WS-04.6 The snippet tabs include CLI and MCP, built from the same form values as the other languages, each linking to its entry in the CLI or MCP reference.

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

## WS-07 CLI and MCP reference

Phase U3 (W15). Plan: [21-reference-and-examples.md](../21-reference-and-examples.md).

- [ ] WS-07.1 Every input in the spec (path, query and body fields of every operation, nested fields included) has a description, and every body field has an example value; a test fails on an undocumented input. (Clarified 2026-10-26: a field whose type has fields of its own takes its example from them, a one-value discriminator such as `kind: "stop"` needs no example, and a map documented with a whole-object example covers its keys; internal requirement IDs are removed from the published descriptions.)
- [ ] WS-07.2 `/cli/` has an entry for every command in the surface catalogue, grouped by area, showing its usage line, positional arguments, flags (name, type, required, allowed values, default, description), the global flags, an example command line, the output type and exit codes, and links to its API operation, MCP tool and app place.
- [ ] WS-07.3 `/mcp/` has an entry for every MCP tool and resource, showing its toolset, annotations (read only, destructive, idempotent), input table (name, type, required, allowed values, description), an example call, the result type, which operation each selector value runs for shared tools, and links to its API operation, CLI command and app place; the exempt operations are listed with their reason.
- [ ] WS-07.4 The API reference links every operation's CLI command and MCP tool to their entries, the CLI and AI guide pages link to the references, and every CLI and MCP cell in the user guide tables is a link to an entry that exists; a test fails on a missing or broken link.
- [ ] WS-07.5 `docs/api/cli-reference.json` and `docs/api/mcp-tools.json` are generated from the spec and the catalogue by the rules in [14](../14-ai-integration.md#flags-and-tool-inputs), and `openapi:check` fails on drift; a test fails when two inputs of one command or tool map to the same flag or property, or when a catalogue override names an input that does not exist.

## WS-08 Code examples

Phase U3 (W15) for WS-08.1 to WS-08.4; WS-08.5 in Phase 2, when email and SMS run for real. Plan: [21-reference-and-examples.md](../21-reference-and-examples.md#5-code-examples-in-every-supported-language).

- [ ] WS-08.1 Every recipe has an In your code section with the whole flow as a tab per language: CLI, PHP (Laravel), JavaScript (Node), Python, Go, Java, Rust, Ruby and C#; a test fails when a recipe misses a language.
- [ ] WS-08.2 Every menu page has a From your code section with the screen's most common task in the same languages.
- [ ] WS-08.3 Every example is checked against the contract: each `/api/v1/...` method and path is in the spec, each JSON key and query name sent is an input of that operation, and each `sendmock` command and flag is in `cli-reference.json`; a test reads every example block. (Changed 2026-10-26: the examples are generated from steps, so the test checks the steps, including required inputs and the answer fields they read, and that every page holds a fresh render.)
- [ ] WS-08.4 The site shows the examples as tabs that work with the keyboard and remember the chosen language across pages and visits; on GitHub each language is a labelled code block. (Clarified 2026-10-26: GitHub shows each language as its own highlighted code block; it does not display tab titles.)
- [ ] WS-08.5 The cross-language matrix runs every recipe example against a real `sendmock` binary in CI.

