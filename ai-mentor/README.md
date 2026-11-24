# AI Mentor

Personal AI tutor program (9:16, YouTube-jaisa screen) — ek topic ek alag chat, meaning first definition last, local AI bhi chalta hai.

## Chalane ka tareeka

```bash
npm install
npm run dev
```

## Workflow (sab local — GitHub ki zarurat nahi)

```bash
npm run typecheck   # TS errors
npm run test        # 27 unit tests (prompt, reducer, diagram parser)
npm run check       # typecheck + test + build — ek command me
npm run test:watch  # tests live chalao
```

- **Pre-commit hook** (`npm install` ke baad apne aap attach): har commit se pehle typecheck + tests chalte hain — galat code commit hi nahi hoga.
- **CI** (`.github/workflows/ci.yml`): repo GitHub pe push hote hi apne aap chalega — same typecheck + test + build + dist artifact.
- **Push-ready**: jab GitHub permission mil jaye ya manually repo banao:
  ```bash
  ./scripts/push-gh.sh          # check → gh se repo create+push (ya instructions)
  ./scripts/push-gh.sh my-name  # custom repo name
  ```

Browser me `http://localhost:5173` kholo (phone-frame layout desktop pe bhi dikhega).

## Local AI (Ollama / LM Studio)

1. Ollama chal raha ho: `ollama serve` (port 11434). LM Studio: `http://localhost:1234`.
2. App → **Settings** → provider **Ollama (local)** select karo → apna model likho (e.g. `llama3.2`) → **Test**.
3. CORS chahiye to Ollama ko aise start karo: `OLLAMA_ORIGINS='*' ollama serve`

## Cloud (free tier)

Settings → **Gemini (free)** → API key paste → model `gemini-2.0-flash` → Test.

Auto-fallback ON ho to cloud limit (429) aate hi app local provider pe switch kar deta hai.

## Docs

- `docs/IMPROVED_IDEA.md` — idea v2 (kya kyun hai)
- `docs/DEV_BRIEF.md` — dev AI ko copy-paste karne wala spec

## Build order

1. ✅ Layout + providers (cloud/local) + chat + fixed teaching prompt
2. ✅ Map + topic-wise branch chats
3. ⬜ Diagram templates (line/pie/flow/arrows) + stage controls
4. ⬜ Atak-gaya buttons + Notes auto-entries + lesson cache + token meter
5. ⬜ X-ray report import + profile update
6. ⬜ Capacitor wrap → APK
