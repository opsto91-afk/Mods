# DEV BRIEF — AI Mentor (copy-paste for dev AI)

> Ye doc seedha kisi bhi dev AI ko de sakte ho (Claude/Cursor/etc). Context: personal study-tutor program, sirf ek user ke liye. Pehle `docs/IMPROVED_IDEA.md` padh lo — ye uska technical spec hai.

## What to build

A phone-first (9:16) AI tutor web app, later wrappable to Android APK (Capacitor). Personal use — no auth, no multi-user, no backend required (localStorage is fine).

## Screen layout

- 9:16 portrait frame, YouTube-video feel.
- Top: **visual stage** (diagram/animation area) with play / pause / timeline slider.
- Bottom: **chat**.
- Draggable divider between them (resize up/down).
- Three panes switchable via side swipe or tab: **Map** (topic tree), **Chat**, **Notes**.

## AI provider layer (must support local AI)

All providers go through one OpenAI-compatible `/chat/completions` path with streaming (SSE).

Presets:
1. **Ollama (local):** `http://localhost:11434/v1`, key empty, model user-typed (e.g. `llama3.2`).
2. **LM Studio (local):** `http://localhost:1234/v1`.
3. **Gemini (cloud, free tier):** `https://generativelanguage.googleapis.com/v1beta/openai/`, model like `gemini-2.0-flash`, user's API key.
4. **Custom:** any OpenAI-compatible base URL + key + model.

Features: per-preset key/model fields, **Test button** (1-token ping, show ok/fail), **auto-fallback**: on 429/limit error switch to local preset (toggleable).

Note: local servers need CORS — document `OLLAMA_ORIGINS=*` for Ollama.

## Teaching system prompt (FIXED, lives in one file, sent every request)

Rules:
1. One small step at a time, 3–5 lines default. Longer only if user says "aur batao".
2. Meaning/problem first; textbook definition LAST.
3. 2+2 first, then 20+20 — user is mature, needs basic blocks before abstractions, never baby-talk.
4. Example from the topic's domain, fresh each time; reuse an old analogy only to connect (no boring repetition).
5. Adopt user's own analogies if given.
6. Never assume or save labels (profession/IQ).
7. Check understanding with "apne words me bata" — don't lecture on.
8. If a visual is needed: output ONLY a fenced ```diagram block with JSON below — never SVG/code.
9. If "Seedha bata" mode: give the direct answer, skip Socratic questions.
10. Language: match user (Hinglish default).

## Diagram instruction format (AI writes JSON, app renders)

AI may append:

```````
```diagram
{"template":"pie","title":"...","parts":[{"label":"A","value":30}]}
```
```````

Templates the app pre-implements (each with play/pause/slider when animated):
- `line` — points/series, y up-down animation
- `pie` — parts with labels
- `flow` — steps array (flowchart boxes + arrows)
- `arrows` — keyframe frames for arrow/movement animation

Levels: L1 text-only (default) · L2 text+diagram (user taps "dikhao" or AI stuck twice) · L3 animation ("chalake dikhao"). Mode switch: Text only / Auto / Visual always.

## Branch chats (Map pane)

- Topic tree: parent topics + sub-topics (boxes). Tap box → opens THAT topic's chat (isolated history).
- New branch gets a 2–3 line summary of parent chat (Summary mode), never full history (saves tokens).
- Returning to parent shows merged summaries of children.
- MVP: manual tree (add topic/subtopic). Later: auto tree from AI, text-select-to-branch, cross-branch links.

## Notes pane (small, editable)

Plain text file per topic-tree (single file MVP). Auto-appended entries:
- Stuck events: "Atak gaya — angle badlo, chhota piece do"
- User feedback buttons: "Bhaari ho gaya", "Example fit nahi", "Pehle meaning"
- Learned preferences: "Definition pehle se dikkat, analogy chalta hai"
Sent (capped ~600 chars) with every request as context. User can edit/delete lines.

## Chat buttons (per message)

`Atak gaya` · `Bhaari ho gaya` · `Example fit nahi` · `Pehle meaning` · `Seedha bata` · `Dikhao` · `Chalake dikhao` · `Aur batao`
Each appends to Notes + adjusts next request (stuck → new angle small piece; seedha → direct mode for that reply).

## Token saving (user is on free tier)

- Reply length cap default 3–5 lines (prompt-enforced).
- Lesson cache: same topic + similar question → serve saved reply, skip API (fingerprint: topic + normalized text).
- Send only last N messages + Notes + branch summary (not full history).
- Approx token/char meter visible; over soft limit → warn + suggest Text-only mode.

## Build order (respect this)

1. ✅ Layout + settings (providers) + chat + fixed prompt
2. ✅ Map + per-topic branch chats + summary handoff
3. Diagram templates (line, pie, flow, arrows) + stage controls
4. Chat buttons + Notes auto-entries + lesson cache + meter
5. X-ray report import (initial hint only) + profile auto-update
6. Capacitor wrap → APK

## Stack (current repo uses)

Vite + React + TypeScript, plain CSS (no UI framework), localStorage persistence. Keep deps minimal. No backend.

## Repo

`opsto91-afk/ai-mentor` — work on `main`. Conventional commits.
