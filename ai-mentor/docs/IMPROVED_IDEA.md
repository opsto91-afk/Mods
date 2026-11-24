# AI Mentor — Improved Idea (v2)

> Base: `22.txt` + `learn.pdf` (56 pages). Is version me un dono ki sab khash baatein hain, plus naye fixes.
> Ye program **sirf tere liye** hai — public app nahi. Isliye onboarding/labels wali dikkatein yahan lagu nahi hoti.

---

## Core Vision (as it is, bina tod-chad ke)

Ek **personal AI tutor program** jo:

1. **Tere sochne ke tareeke se padhaye** — profession/label save nahi (Doctor/Engineer/High-IQ), sirf *dimaag ki wiring* samjhe (imagination, logic, pace).
2. **Topic-wise branches** — ek topic = ek alag chat. Context mix nahi hota, token bhi bachte hain.
3. **Meaning first, definition last** — pehle problem/situation, phir example, end me book wali definition.
4. **2+2 → 20+20** — tu mature hai; basic blocks pata hain, complex abstraction toot ke aani chahiye. Bache wali bhasha nahi.
5. **Ratta nahi, problem solver** — "apne words me bata" wala check, Socratic but seedha jawab bhi (button se).
6. **Jarurat par hi visual** — default chhota text; diagram/animation tabhi jab topic maange ya tu bole.
7. **Boring repeat nahi, connected reuse haan** — translator analogy Bretton Woods me reuse karo (jodna aasaan), par wahi example 10 baar nahi.

---

## Kamzoriyan jo theek kar diye (v1 critique se)

| # | Problem (22.txt) | Fix (v2) |
|---|---|---|
| 1 | "Brain scan" = learning-style matching (research khilaaf) | Scan ka base **prior knowledge** hai ("2+2 aata hai, 20+20 nahi"), style nahi. X-ray report sirf initial hint — asli learning **chat se update** hoti hai |
| 2 | Ek baar ka report kaafi nahi | Profile **har topic ke saath** update hoti hai (Notes file live rehti hai) |
| 3 | "Kabhi repeat nahi" galat | Rule: **boring repeat band, connected reuse chalu** — pichhla example reuse sirf tab jab usse jodna ho |
| 4 | Socratic har jagah slow | **"Seedha bata" button** — ek tap pe seedha jawab, bina sawal ke. Default chhota step-wise |
| 5 | Bahut saari cheezein ek saath | Emotion tracking (typing-speed wali) **hata di**. Pehle sirf: tree + alag chats + fixed prompt. Baad me |
| 6 | Pehle wali AI ki "10/10" tareef | Ignore — cheerleading thi, evidence nahi |

---

## Naye improvements (v2 — is baar ka add-on)

### 1. 🔌 Local AI support (sabse bada naya)
Free user ho — cloud ki limit jaldi khatam. Isliye **provider layer**:

- **Cloud presets:** Gemini free tier (OpenAI-compatible endpoint), ya koi bhi OpenAI-compatible API (key + base URL + model apna daal)
- **Local presets:** Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), llama.cpp server — koi bhi OpenAI-compatible local server
- **Auto-fallback:** cloud ne 429/rate-limit maara → turant local pe switch (setting on/off)
- **Health check:** Settings me "Test" button — connected hai ya nahi, pata chale
- Ek hi code path: sab kuch OpenAI-compatible chat/completions format me (streaming ke saath)

### 2. 🎨 Diagram = instruction, drawing nahi (AI ko aankh, haath nahi)
AI **khud drawing nahi banata**. Sirf structured JSON deta hai:

````text
```diagram
{"template":"pie","title":"Budget","parts":[{"label":"Health","value":30},{"label":"Army","value":70}]}
```
````

App ke **4 pre-made templates** use hote hain: `line` (graph upar-neeche), `pie` (hissa), `flow` (steps), `arrows` (frame-based animation). Har template ke paas **play / pause / slider** controls. Isse:
- Token bachte hain (chhota JSON vs lamba SVG code)
- AI ki galat drawing ka risk khatam
- Animation engine pehle se bana hota hai

### 3. 🧠 3-Level visual (kharcha control)
- **Level 1 (default):** 3-4 line text — hamesha
- **Level 2:** text + diagram — jab tu "dikhao" dabaye, ya AI ko 2 baar samjhane ke baad bhi atka
- **Level 3:** animation (frames + slider) — sirf "chalake dikhao" pe
- Switch: **Text only / Auto / Visual always** — free limit kareeb ho to Text only

### 4. 🚀 "Atak gaya" + feedback buttons (X-ray report ki jagah)
Har message pe buttons: **"Atak gaya" · "Bhaari ho gaya" · "Example fit nahi" · "Pehle meaning" · "Seedha bata"**
- Tap → AI wahi baat **chhote piece me, naye angle se** dobara samjhaye (last example repeat nahi)
- Ye taps **Notes file me append** hote hain → har request ke saath AI ko jaati hain
- Isse tu khud seekhega program ko — 15-min report ki zarurat nahi

### 5. 📝 Chhoti live Notes file (labels nahi)
App khud update karta hai, tu edit kar sakta hai. Har chat ke saath AI ko jaati hai. Example entries:
- "Definition pehle se dikkat hoti hai, analogy chalta hai"
- "GDP wala example fit nahi tha — tech domain se do"
- "Ek baar me sirf ek chhota step, pehle meaning"

### 6. 💾 Token bachane ke rules (free user)
- Replies 3-5 line default; "aur batao" tabhi lamba
- **Lesson cache:** same topic + similar question → purana saved lesson (AI ko bula hi mat)
- History poori mat bhejo — sirf pichhle N messages + branch summaries
- Diagram JSON chhota, templates client-side
- Token meter: approx kharcha dikhao (chars/requests) — limit kareeb ho to warning + Text-only mode

### 7. 🗺️ Branch chat (research-backed, MVP me simple)
- Map pane: topic tree. Box pe tap → uski **apna chat**
- Nayi branch me **Summary mode** default (pichhla sab raw nahi — sirf 2-3 line digest)
- Main pe wapas aao → branches ka summary merge
- Baad me: cross-branch connection (Physics + Maths pul), volatile/permanent branch, text-select se branch

### 8. 📱 Screen (9:16, YouTube jaisa)
- **Upar:** visual stage — diagram/animation + play/pause/slider
- **Neeche:** chat
- **Beech:** draggable divider (upar-neeche bada-chhota)
- **Swipe/side se 3 windows:** Map · Chat · Notes
- Phone-first; desktop pe center frame. APK ke liye baad me Capacitor wrap

---

## Build Order (v2 — is repo me)

| Phase | Kya | Status |
|---|---|---|
| **P0** | Repo + layout (9:16, divider, 3 panes) + settings (cloud/local provider) | ✅ shuru |
| **P1** | Chat + fixed teaching prompt + streaming + topic-wise branch chats | ✅ shuru |
| **P2** | Diagram templates (line, pie, flow, arrows) + play/pause/slider + level switch | baad me |
| **P3** | Atak-gaya buttons + Notes file + lesson cache + token meter | baad me |
| **P4** | X-ray report import (initial hint) + profile auto-update | last |
| **P5** | Capacitor se APK wrap | last |

**Fixed teaching prompt** (app ke andar ek jagah, har chat me yahi):
1. Ek baar me sirf ek chhota step (3-5 line)
2. Pehle meaning/problem, definition LAST me
3. 2+2 pehle, 20+20 baad me
4. Example topic se hi, har baar naya; connected reuse OK, boring repeat nahi
5. User ka analogy aaye to adopt karo (translator wala)
6. Koi label save/assume mat karo
7. Ratta mat banao — "apne words me bata" se check karo
8. Diagram chahiye to sirf ```diagram JSON``` — kabhi SVG/mat drawing code likho mat
9. "Seedha bata" mode ho to seedha jawab, sawal chhod ke
