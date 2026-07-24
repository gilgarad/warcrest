# Dev-Wiki Contract

These are the operating guidelines for agent work here. Two rules are
mandatory (one generic, one specific to this project); everything else
guides judgment.

## The One Rule (generic, from AGENTS.md)

Do not change files without leaving a backlog record.

Preferred:

- GitHub Issue + `backlog.md` entry

Fallback:

- `log.md` entry

Recording is mandatory because it keeps work visible and reviewable.

## The Second Rule (this project only): log AI usage every turn

This repository is an NHN `nan2026` AI game jam entry. The contest requires
showing how AI tools were directed and what they produced — that record is
**not optional** here, unlike most other guidance in this file.

**After every turn that involves a real decision, non-trivial code, or a
direction change**, append an entry to `docs/ai-usage/session-log.md`
(format and cadence: `docs/ai-usage/README.md`). This is separate from and
in addition to The One Rule above — `backlog.md`/`log.md` track work
chronology, `docs/ai-usage/` tracks the AI-collaboration story itself. If a
session skips this, it has broken a project requirement even if the backlog
record above was kept perfectly.

This rule applies regardless of how the session was started — if a user
message says only "follow this repo's local harness rules," that includes
this rule, because it lives in the file the harness convention says to read
third.

## Source Of Truth Map

- GitHub Issues: task status
- `backlog.md`: planning context, dependencies, issue/branch/PR linkage
- `index.md`: current authoritative wiki pages
- `log.md`: append-only chronology
- `docs/ai-usage/`: per-turn AI-usage record — **mandatory for this
  project**, see "The Second Rule" above
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
