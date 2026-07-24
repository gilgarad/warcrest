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

**Quote pivotal instructions verbatim, not just paraphrased.**
`docs/knowledge/contest-requirements.md` (submission item 4) explicitly
asks for "AI 대상 주요 프롬프트 및 지시 사항" — the actual prompts, not a
summary of them. For turns where the user gives a *creative direction* or a
*correction* (a reference like "Diablo's isometric view," a tone like
"Clash of Clans," a rejection like "이거 너무 추상적으로 말한 것 같다") —
pull the exact Korean phrasing into the entry in quotes. That's the
evidence of *directing* skill the contest is scoring, and a paraphrase
flattens exactly the part that shows it. Routine/mechanical turns (build
fixes, doc housekeeping) don't need this — summary is fine there.

## Cadence

Update after any session that produces a meaningful design decision,
non-trivial code, or a pivot in direction. Trivial back-and-forth (typo
fixes, one-line tweaks) doesn't need its own entry — fold it into the next
substantive one.