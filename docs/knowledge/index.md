# Knowledge Index

Durable project memory for `game_project1`.

## Project Overview

- Goal: build a playable game using AI coding agents (Claude Code, Codex,
  Gemini, etc.) for the NHN `nan2026` AI game jam
  (`https://nan2026.nhn.com`, entry via wanted campaign link).
- **Full official submission requirements (verbatim)**:
  `docs/knowledge/contest-requirements.md`. Read this before assuming what
  the contest needs — do not paraphrase from memory.
- The deliverable that this repository covers is submission item 1: a
  playable web build (browser) or mobile app (APK) plus full source code.
  Items 2-5 (play video, game intro doc, AI-usage doc, team-role doc) are
  produced from this repo's history and docs, not stored as source code here.
- Tech stack: **decided** — Phaser 3 + TypeScript + Vite (see
  `docs/dev-wiki/game-concept.md` and `docs/rules/testing.md` for real
  commands).
- Team: solo/individual entry unless stated otherwise (affects submission
  item 5, which is skippable for individual entries per
  `docs/knowledge/contest-requirements.md`).

## GitHub / Remote

- No GitHub repository exists for this project yet. The user will create one
  and provide it later; only then should a `remote.origin` be added.
- When the remote is added, reuse the same GitHub account/credential pattern
  already used for `/data/projects/stock_predict` (HTTPS remote with a PAT
  embedded in the **local, untracked** `.git/config`, never in a tracked
  file). Do not paste the token value into any doc, commit, or log — see
  `docs/rules/security.md`.
- Until a remote exists, treat this repo as local-only; GitHub Issues cannot
  back backlog entries yet, so `docs/dev-wiki/log.md` is the fallback record
  per the one hard rule in `AGENTS.md`.

## AI-Usage Logging (contest requirement, separate from dev-wiki)

- The contest requires showing how AI tools were directed and what they
  produced, turn by turn. This is tracked in `docs/ai-usage/session-log.md`,
  which is **separate from** `docs/dev-wiki/log.md` (dev-wiki log is for
  work chronology/backlog hygiene; the AI-usage log is raw material for
  submission item 4, the "AI 활용 기술 문서" PDF).
- See `docs/ai-usage/README.md` for the entry format and update cadence.

## Environments

- Local dev machine only so far. No deploy target chosen yet (candidates:
  GitHub Pages for a web build, per the harness's existing GitHub Pages
  pattern used in `stock_predict`).

## Gotchas

- This repo must stay fully independent from `/data/projects/stock_predict*`
  — no shared code, no cross-imports. Credential *pattern* is reused;
  content and history are not.
