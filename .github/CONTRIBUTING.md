# Contributing to SendMock

Thanks for helping. This page covers setup, branches, commits and tests; the full rules for code are in [AGENTS.md](../AGENTS.md), and the plan is in [docs/plan](../docs/plan/README.md).

## Setup

SendMock uses [Bun](https://bun.sh) for all JavaScript; do not add npm, pnpm or yarn lockfiles.

```bash
cd web && bun install && bun run dev        # the web UI with demo data, http://localhost:5173
cd website && bun install && bun run dev    # the website and docs, http://localhost:5190
```

## Branches

- Branch from the latest `develop`: `feat/*`, `fix/*`, `docs/*` or `chore/*`.
- Open pull requests into `develop`. `main` only takes merges from `develop` when a stable release is promoted.

## Commits

- `feat:[TICKET] summary` for features and `fix:[TICKET] summary` for fixes, the ticket in square brackets right after the colon.
- `docs:`, `test:`, `chore:`, `ci:` and `refactor:` for everything else; `feat!:` for breaking changes.
- No co-author trailers.

## Tests

Every change comes with tests that run in CI:

```bash
cd web
bun run lint && bun run typecheck
bun run test            # unit tests
bun run test:e2e        # Playwright
bun run test:contract   # the OpenAPI contract
```

Tests that prove an acceptance criterion name its ID, for example `test("EM-01.3 ...")`.

## Labels

| Label | Used for |
| --- | --- |
| `bug` | Something does not work (the bug report form) |
| `enhancement` | A new feature or improvement (the feature and provider forms) |
| `provider` | A provider to emulate (the provider form) |
| `docs` | A docs page that is wrong or missing (the docs form) |
| `u3-feedback` | Feedback on the UI preview during Phase U3 |

## Docs

User docs live in [docs/wiki](../docs/wiki) as Markdown and are published on the website. Write plain, concrete sentences and never use the em-dash character.
