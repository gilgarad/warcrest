# Dev-Wiki Contract

These are the operating guidelines for agent work here. One rule is mandatory;
everything else guides judgment.

## The One Rule

Do not change files without leaving a backlog record.

Preferred:

- GitHub Issue + `backlog.md` entry

Fallback:

- `log.md` entry

Recording is mandatory because it keeps work visible and reviewable.

## Source Of Truth Map

- GitHub Issues: task status
- `backlog.md`: planning context, dependencies, issue/branch/PR linkage
- `index.md`: current authoritative wiki pages
- `log.md`: append-only chronology
- `docs/knowledge/`: durable project knowledge and memory
- `docs/patterns/`: reusable implementation and workflow patterns
- `docs/wiki/`: human-facing documentation policy and wiki management notes
- `docs/harness/`: local harness provenance and adaptation notes

## Guidelines

- Start from a backlog entry and load the page relevant to the task.
- Prefer one issue -> one branch -> one PR.
- Keep backlog, index, and log current when the underlying reality changes.
- Move closed work into a historical section and summarize it.
- When deviating from the default workflow, record the reason.

## Document Shape

- Keep files atomic: one concern per file.
- Use `index.md` as a router.
- Prefer linking over duplication.
- Split oversized pages rather than letting them become monoliths.

## Health Hints

- Large pages should be split or summarized.
- Stale guidance should be rewritten or removed.
- Duplicate authority should merge or archive.
- Backlog entries without live work should leave the active queue.
