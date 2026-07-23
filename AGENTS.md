# Agent Operating Contract

This is the first file agents should read in this repository. Keep it short and
route deeper context through `docs/index.md`.

## The One Rule

Do not change files without leaving a record.

Preferred record:

- one GitHub Issue
- one backlog entry in `docs/dev-wiki/backlog.md`

Minimum fallback record:

- one entry in `docs/dev-wiki/log.md`

This is the only hard process rule. Everything else is guidance.

Security is a separate standing guardrail: never commit secrets, credentials,
tokens, runtime config, production data, or private user data.

## Guidelines

- Work on a branch, not directly on `main` or `master`.
- Tie work to a GitHub Issue when available.
- Read `docs/index.md` and load the page relevant to the current task.
- In the first work update, state branch, issue, backlog entry, and page loaded.
- Keep docs in step with code and workflow changes.
- Run the narrowest useful verification before finishing; if it cannot run, say
  why.

## Lazy-Load Map

Start with `docs/index.md`, then load only what matters:

- workflow: `docs/rules/workflow.md`
- security: `docs/rules/security.md`
- testing: `docs/rules/testing.md`
- docs maintenance: `docs/rules/docs.md`
- dev-wiki operating model: `docs/dev-wiki/contract.md`
- project memory: `docs/knowledge/index.md`
- project patterns: `docs/patterns/README.md`
- wiki management: `docs/wiki/index.md`

## Notes For Maintainers

This file is intentionally generic. Project-specific rules belong in `docs/`.
Once this harness is copied into a repository, that repository's local copy is
authoritative and should be updated in place.
