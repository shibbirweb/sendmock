## Summary

What this changes and why, in a few sentences.

Closes #

## Test plan

Plain bullets: what you ran and what you checked.

- 

## Checklist

Plain bullets; delete the ones that do not apply.

- Parity: a backend feature has its UI, REST endpoint, CLI command, MCP tool and skill docs.
- Tests name the acceptance criteria they prove (`// AC: EM-01.3`, `test("EM-01.3 ...")`), and criteria are ticked in `docs/plan/acceptance/`.
- `docs/plan/PROGRESS.md` is updated, with a log line for anything notable.
- A user-visible change adds its line under `## [Unreleased]` in `CHANGELOG.md`, written for users; the title keeps the commit format (`feat:`, `fix:`, `chore:`), since it drives the version bump. Versions are written by the Prepare release workflow, not by hand.
- No em-dash characters in code, comments, commits or docs.
