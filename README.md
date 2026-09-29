# Shiksha Vani · शिक्षा वाणी
**AI-powered vernacular pedagogy and real-time translation for mother-tongue education**
Smart India Hackathon 2026 · Problem statement 26042 · Team Brute Force

An offline-first PWA + FastAPI backend that lets a teacher speak once (Hindi/English) while every child reads
the lesson in Santali, Mundari, Ho or Kurukh, with reading practice, an AI tutor, teacher analytics with early
warnings, and a parent app in the parent's own language.

## Run it (5 minutes)

**Requirements:** Python 3.10+, Node 18+.

```bash
# 1. Backend  (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # optional; defaults work
uvicorn app.main:app --reload --port 8000              # seeds demo data on first start

# 2. Frontend (terminal 2)
cd frontend
npm install
npm run dev                                            # http://localhost:5173
```

Open http://localhost:5173 and tap **Student / Teacher / Parent**. Demo logins: `teacher`, `parent`, `sona`,
`anita`, `birsa`, `sunita`; password `demo123`.

**Single-server build** (what you would deploy): `cd frontend && npm run build`, then just run the backend;
it serves `frontend/dist` on http://localhost:8000. Docker: `docker compose up --build`.

**Tests:** `cd backend && pytest -q` (19 tests, including the WebSocket live class).

## What is built (mapped to your deck)

| Deck idea | Where it lives |
|---|---|
| Real-time translation | `backend/app/routers/live.py` WebSocket room; teacher console `pages/teacher/Live.jsx`; child view `pages/student/LiveClass.jsx` |
| Adaptive mother-tongue lessons | `routers/learn.py` (`localized_lesson`), `services/analytics.recommendations` |
| Offline-first lightweight app | `vite-plugin-pwa` service worker + IndexedDB cache and sync queue (`lib/api.js`, `lib/session.jsx`), idempotent `POST /api/sync` |
| Multi-dialect support | Language registry, per-string translation status, teacher review queue |
| Parent-Teacher bridge | `pages/parent/Home.jsx`, `routers/parent.py`, messages auto-translated both ways |
| Speech practice | `pages/student/Practice.jsx`, word-level scoring (`lib/speech.js`, `services/speech.py`) |
| Teacher dashboard + learning alerts | `pages/teacher/Overview.jsx`, `services/analytics.py` (5 alert rules, each with a suggested action) |
| Vernacular library | Lessons + **Bhasha Kosh** community dictionary with voice recordings |
| Semantic-similarity content matching | `services/translation.py` (TF-IDF cosine over the translation memory) |
| Bilingual progress report export | `pages/teacher/PrintReport.jsx` (print / save as PDF) and CSV export |

**Extras added beyond the deck:** "I did not get this" signal (per lesson line and live) feeding the teacher;
teacher-in-the-loop translation review with live push to children's screens; class recap notes in the child's
language; community word bank with audio; text size and read-aloud settings; installable PWA.

## Architecture

```
Teacher mic --Web Speech (or Bhashini/Whisper)--> text
   |  WebSocket
   v
FastAPI room --> translate(): 1 translation memory (exact)
                              2 Bhashini (if keys)
                              3 public MT for hi/en/bn/or (opt-in)
                              4 closest saved sentence (teacher console only)
                              5 else: flagged "missing"
   |  every MT result is stored as a DRAFT -> teacher approves/edits -> VERIFIED -> reused offline
   v
Child app (React PWA)  <--->  IndexedDB (lessons, last answers, event queue)  --sync when online--> /api/sync
```

## Turn on the real AI (all optional, set in `backend/.env`)

* **Bhashini** (sentence-level Santali etc.): register at https://bhashini.gov.in, create ULCA API keys, set
  `BHASHINI_USER_ID` and `BHASHINI_API_KEY`. Then open Content review > Translate a lesson: drafts appear for
  teachers to approve. Language codes can be overridden with `BHASHINI_CODE_OVERRIDES="unr=mun"`.
* **AI tutor with Claude:** set `ANTHROPIC_API_KEY` (model via `ANTHROPIC_MODEL`). Without it the tutor answers
  from lesson text (retrieval) and works without any AI service.
* **Server speech-to-text** for languages the browser cannot recognise: Bhashini ASR, or an OpenAI-compatible
  Whisper endpoint via `WHISPER_API_URL`.
* **PostgreSQL:** `DATABASE_URL=postgresql+psycopg://user:pass@host/db` and `pip install "psycopg[binary]"`.

## Known gaps: read before you present

1. **Tribal-language content is draft.** The Santali/Mundari/Ho/Kurukh words in the seed data (numbers, tree,
   water, family words...) were written from general knowledge, are shown with a "draft" tag, and **must be checked
   by a native speaker before you claim they are correct.** Kurukh has the fewest entries on purpose. Whole-sentence
   tribal translation is **not** faked: without Bhashini or a teacher-authored line, children see Hindi with a
   clear notice. Confirm in the Bhashini catalogue which of these four languages it supports for translation
   before stating coverage to the judges.
2. **Untested here (no network/credentials in the build sandbox):** the Bhashini client (written to their public
   pipeline API), the Claude tutor call, the Whisper/Bhashini ASR path, Docker and PostgreSQL. Everything else
   (backend tests, the production build, a real browser session, offline reload + queued sync, and the live
   teacher-to-student WebSocket flow) was run.
3. Speech recognition/voice use the browser's engines: works in Chrome (Android/desktop); there is no Santali
   TTS/ASR in browsers, so tribal text is read on screen and Hindi/English is read aloud.
4. Live-class rooms are in-process memory (fine for a school). Use Redis pub/sub to scale across servers.
5. Security is demo grade: turn off `DEMO_MODE`, set a real `JWT_SECRET`, add rate limiting, and review the
   handling of children's data under the DPDP Act before any real pilot.
6. DIKSHA / Adi Vaani integrations from the deck are not implemented; the translation layer is where they plug in.
7. Teacher screens are English only; student and parent screens are English, Hindi and Bengali (tribal-language
   users see Hindi interface text).

## Project layout
```
backend/app/  main.py  models.py  seed.py  content.py  languages.py  security.py
              routers/ auth learn student teacher parent live
              services/ translation bhashini speech analytics tutor reports text
backend/tests/  test_api.py
frontend/src/ App.jsx  lib/ (api, session, store, speech, ws, i18n)  components/  pages/{student,teacher,parent}
docs/         DEMO_SCRIPT.md  screenshots/ (real captures of the running app)
```
