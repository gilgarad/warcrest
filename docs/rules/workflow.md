# Workflow Guidelines

The hard rule is simple: do not change files without leaving a record.

Everything below is a guideline. Follow by default; deviate with reason and
record the deviation.

## Branches

- Work on a branch, not `main` or `master`.
- Prefer `issue-<number>-short-topic`.
- Branch fresh from trunk per unit of work.
- Avoid deep PR stacks unless the project explicitly wants them.

## Issues And PRs

- Tie work to a GitHub Issue when available.
- Use `Refs #<issue>` in commits.
- Use `Closes #<issue>` in the PR when it resolves the issue.
- Open the PR and let the owner merge, unless merge authority is delegated.

## Review

- Keep changes reviewable.
- Preserve existing user changes in the working tree.
- Do not hide failed verification.
