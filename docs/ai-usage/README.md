# AI Usage Log

This directory exists for one reason: the NHN `nan2026` game jam requires
submission item 4, an "AI 활용 기술 문서" (AI usage / technique document)
showing how AI tools were directed and what they produced.

This is **separate from** `docs/dev-wiki/log.md`. The dev-wiki log tracks
work chronology for the harness's backlog discipline (the "one rule" in
`AGENTS.md`). This log tracks the AI-collaboration story itself: prompts
given, tools/agents used, and what came out — raw material to compile into
the final PDF, not a record of *what changed in the repo*.

## What Goes In `session-log.md`

One entry per meaningful turn/session with an AI agent. Append-only, do not
edit past entries except to fix factual errors.

Per entry:

- date, which agent/tool (Claude Code, Codex, Gemini, etc.), and model if
  known
- a short summary of what the user asked for
- a short summary of what the agent did / produced
- anything notable about the interaction (multiple agents used together,
  a correction needed, a design decision made through the conversation)

Keep entries brief — a few lines each. This is a log, not a transcript. If a
turn is unusually significant (e.g. it decided the game concept or the tech
stack), say so explicitly so it's easy to find when compiling the final PDF.

## Cadence

Update after any session that produces a meaningful design decision,
non-trivial code, or a pivot in direction. Trivial back-and-forth (typo
fixes, one-line tweaks) doesn't need its own entry — fold it into the next
substantive one.