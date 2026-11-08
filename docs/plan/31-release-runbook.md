# 31. The 1.0 release runbook

The owner's steps from [Phase 5](30-phase-5.md#owner-steps), in order, with the commands to run and what to check after each. Everything else is built and tested in CI, so these steps only run what is already proven.

Before each step, check what is still open:

```sh
bun scripts/release-readiness.ts
```

It lists every secret and variable the workflows read that the repository does not have yet, every feature that is not `Accepted`, and every unticked criterion with the step below that proves it. A unit test keeps this page complete: it fails when a workflow reads a secret this page does not name, or when an unticked criterion has no step.

## 1. Check the trademark

Search "SendMock" in the USPTO, EUIPO and WIPO databases ([10](10-open-questions.md)). If the name is taken for software, stop and pick a new name before anything is published.

## 2. Create the accounts and repositories

1. The Homebrew tap `shibbirweb/homebrew-tap` and the Scoop bucket `shibbirweb/scoop-bucket`, both public.
2. The npm organisation `sendmock`, for the `@sendmock/*` platform packages.
3. A crates.io account.
4. A fork of `microsoft/winget-pkgs`.
5. A Chocolatey account.
6. An AUR account with an SSH key.
7. The COPR project `shibbirweb/sendmock`.
8. PyPI, NuGet and Maven Central (Sonatype) accounts, for the Testcontainers modules.
9. A Docker Hub account and the repository `shibbirweb/sendmock`, if the image should also be on Docker Hub (GHCR works without it).

## 3. Set the secrets and variables

Each workflow skips a channel whose secret is missing, so a channel can be added later. Set each secret with:

```sh
gh secret set SECRET_NAME --repo shibbirweb/sendmock
```

| Secret | What it is | Without it |
|--------|------------|------------|
| `RELEASE_TOKEN` | A fine-grained token with contents and pull request write on this repository | The release and promote pull requests do not start CI by themselves |
| `NPM_TOKEN` | An npm granular access token with read and write on all packages, for the first beta only (npm sets a trusted publisher only on a package that exists); delete it once the trusted publishers are set (step 6) | The first beta cannot create the npm packages |
| `DOCKERHUB_USERNAME` | The Docker Hub user | The image is only on GHCR |
| `DOCKERHUB_TOKEN` | A Docker Hub personal access token with read and write; the Docker job creates the public repository `shibbirweb/sendmock` before its first push, and stops if it exists but is private | The image is only on GHCR |
| `HOMEBREW_TAP_TOKEN` | A token with contents write on `shibbirweb/homebrew-tap` | No Homebrew formula |
| `SCOOP_BUCKET_TOKEN` | A token with contents write on `shibbirweb/scoop-bucket` | No Scoop manifest |
| `PACKAGES_GPG_PRIVATE_KEY` | An unprotected signing key for the APT and YUM repository (see below); the website publishes its public half | No APT or YUM repository |
| `WINGET_TOKEN` | A classic token with `public_repo`, for the pull request to `microsoft/winget-pkgs` | No WinGet submission |
| `CHOCOLATEY_API_KEY` | The Chocolatey API key | No Chocolatey push |
| `AUR_SSH_PRIVATE_KEY` | The AUR account's SSH key | No AUR update |
| `COPR_CONFIG` | The COPR API configuration (`~/.config/copr`) | No COPR build |
| `MAVEN_CENTRAL_USERNAME` | The Sonatype user token name | No Java Testcontainers module |
| `MAVEN_CENTRAL_TOKEN` | The Sonatype user token | No Java Testcontainers module |
| `MAVEN_SIGNING_KEY` | The armoured GPG key Maven Central checks | No Java Testcontainers module |

Make the packages signing key:

```sh
gpg --quick-gen-key "SendMock packages" ed25519 sign never
```

```sh
gpg --armor --export-secret-keys "SendMock packages" | gh secret set PACKAGES_GPG_PRIVATE_KEY --repo shibbirweb/sendmock
```

npm, PyPI and crates.io publish through trusted publishing, all from one top-level workflow, `registry-publish.yml`. npm is the exception for the first beta only: its packages do not exist yet and npm sets a trusted publisher only on an existing package, so set `NPM_TOKEN` and `NPM_PUBLISHING` now and the npm trusted publishers after the first beta (step 6) (registries cannot trust a called workflow, [30](30-phase-5.md) W18): on PyPI (`sendmock-testcontainers`, as a pending publisher), NuGet (a trusted publishing policy for `SendMock.Testcontainers`, user `shibbirweb`) and crates.io (every workspace crate), add this repository (`shibbirweb/sendmock`) with the workflow file `registry-publish.yml` and no environment as the trusted publisher, then set its variable, `NPM_PUBLISHING`, `PYPI_PUBLISHING`, `NUGET_PUBLISHING` or `CRATES_PUBLISHING`, to `true`:

```sh
gh variable set NPM_PUBLISHING --body true --repo shibbirweb/sendmock
```

```sh
gh variable set PYPI_PUBLISHING --body true --repo shibbirweb/sendmock
```

```sh
gh variable set NUGET_PUBLISHING --body true --repo shibbirweb/sendmock
```

```sh
gh variable set CRATES_PUBLISHING --body true --repo shibbirweb/sendmock
```

Check: `bun scripts/release-readiness.ts` lists no missing secret or variable for the channels you want in 1.0.

## 4. Review the last two screens

Review the Subscriptions and API reference screens, the two added after the design sign-off, against the checklist in [18](18-phase-u3.md#w1-and-w6-design-review), and sign off their rows in the [review table](18-phase-u3.md#review-table). UI-07 then becomes `Accepted`.

The skill's evals need no step: CI runs them on every pull request with a scripted agent, so no model and no API key are involved (AI-05.7, changed 2026-11-08).

## 5. Merge #48 into `develop`

```sh
gh pr merge 48 --repo shibbirweb/sendmock --merge
```

The push to `develop` runs CI, then Docker edge publishes the `edge` image, signs it and runs `docker-published-check.sh` against the registry.

Check: the Docker edge run on `develop` passes its published check.

Proves: DS-02.5

## 6. Publish the first beta

Preview the version and changelog first:

```sh
gh workflow run release-prepare.yml --repo shibbirweb/sendmock -f bump=minor -f dry_run=true
```

Then open the release pull request:

```sh
gh workflow run release-prepare.yml --repo shibbirweb/sendmock -f bump=minor -f dry_run=false
```

Merge the release pull request once its CI passes. Publish beta then tags the version and runs the Release build, which publishes every channel whose secret is set; when it finishes, Registry publish sends the release to npm and PyPI.

When Registry publish has finished, install the release through the channels that publish at once (replace `0.1.0-beta.1` with the version):

```sh
gh workflow run install-channels.yml --repo shibbirweb/sendmock -f version=0.1.0-beta.1 -f channel=beta -f channels=after-publish
```

Check: the Registry publish run published the npm packages (and the PyPI module, if `PYPI_PUBLISHING` is set) from its plan job's decision, the Release build's service-container job passed, its "Helm chart on GHCR" job installed the chart from `oci://ghcr.io/shibbirweb/charts` without logging in, its "Docker Desktop extension on GHCR" job read the extension image back without logging in, the Install channels run passed (its `npx` channel runs `npx sendmock@<version>` with no install), and `/next/` on the website shows the Beta banner. On the repository's Packages page, `sendmock`, `charts/sendmock` and `sendmock-docker-extension` are public; a package a workflow creates takes the repository's visibility, so if one is private, make it public in its settings and run the job again.

Then remove the notices that say there is no release yet, in a pull request to `develop`: the "Downloads start with the first beta" lines at the top of `docs/wiki/install.md` and `docs/wiki/getting-started.md`, the "Not released yet" line of `docs/wiki/index.md`, the "first beta is being prepared" paragraph of `README.md`, and the hero's "Not released yet" pill in `website/components/landing/hero-section.tsx`. The website's version banner, `llms.txt` and the changelog page follow the real releases by themselves.

Then move npm to trusted publishing: on each of the eight npm packages (`sendmock`, the six `@sendmock/<os>-<cpu>` packages and `sendmock-testcontainers`), open **Settings > Trusted Publisher**, choose GitHub Actions, and enter `shibbirweb`, `sendmock`, `registry-publish.yml` and no environment; then delete the token:

```sh
gh secret delete NPM_TOKEN --repo shibbirweb/sendmock
```

Proves: DS-02.6, DS-03.7, WS-03.7, DS-09.5, DS-10.5, DS-03.8

## 7. Publish 1.0.0

```sh
gh workflow run release-prepare.yml --repo shibbirweb/sendmock -f bump=major -f dry_run=false
```

Merge the release pull request, then the promote pull request into `main` that Promote stable opens. Publish stable tags `v1.0.0`, runs the Release build and publishes the website's 1.0 docs at `/`; when it finishes, Registry publish sends the release to npm, PyPI and crates.io and publishes the MCP registry entry. Once Registry publish has finished, install it:

```sh
gh workflow run install-channels.yml --repo shibbirweb/sendmock -f version=1.0.0 -f channel=stable -f channels=after-publish
```

Check: the website serves the 1.0 docs at `/` and the `develop` docs at `/next/`.

Proves: WS-03.1

## 8. Open the Nixpkgs pull request and install from every channel

Open a pull request to `NixOS/nixpkgs` with `packaging/nix/package.nix`. When WinGet, Chocolatey, COPR and Nixpkgs have taken `1.0.0` (each reviews on its own schedule), install from every channel:

```sh
gh workflow run install-channels.yml --repo shibbirweb/sendmock -f version=1.0.0 -f channel=stable
```

Check: every channel passes on every operating system it serves. This is the Phase 5 done-when proof.

## 9. Make `main` the default branch

```sh
gh repo edit shibbirweb/sendmock --default-branch main
```

## 10. Check the GitHub MCP Registry

GitHub's MCP Registry (`github.com/mcp`) is curated from the official MCP registry, which step 7 published to, and has no submission form of its own. A few days after 1.0, search it for SendMock. If it is not listed, ask for it in GitHub's community discussions for the MCP Registry, naming `io.github.shibbirweb/sendmock`. Once listed, later versions follow from the official registry by themselves.

Check: SendMock is on `github.com/mcp` and installs from it.

Proves: AI-05.8
