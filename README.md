# 🗣️ Shiksha Vani · शिक्षा वाणी

> **AI-Powered Vernacular Pedagogy and Real-Time Translation for Mother-Tongue Primary Education**

**Smart India Hackathon 2026 · Problem Statement SIH26042 · Team Brute Force**

---

## 🌟 Overview

**Shiksha Vani** is an offline-first, AI-enabled learning platform designed to make primary education more accessible to children who learn best in their **mother tongue**.

The platform enables a teacher to speak a lesson once in **Hindi or English**, while students can receive the content in supported vernacular languages such as **Santali, Mundari, Ho, and Kurukh** where verified content or translation is available.

Shiksha Vani combines:

- 🎙️ Real-time classroom speech and translation
- 🌐 Mother-tongue learning support
- 📱 Offline-first Progressive Web App (PWA)
- 🧑‍🏫 Teacher analytics and early-learning alerts
- 👨‍👩‍👧 Parent–teacher communication
- 🤖 AI-assisted tutoring
- 🗣️ Reading and speech practice
- 📚 Vernacular learning resources
- 🔄 Teacher-in-the-loop translation verification

The goal is not simply to translate text, but to create a **complete learning ecosystem around the learner's language**.

---

## 🎯 Problem We Address

Many children in multilingual and underserved communities face a language barrier when classroom instruction is delivered primarily in a language different from the one they use at home.

This can affect:

- Understanding of classroom concepts
- Reading confidence
- Participation
- Communication with teachers
- Parent–teacher interaction
- Access to digital learning resources

Shiksha Vani addresses this challenge by connecting **teacher speech → translation → localized learning → practice → analytics → parent communication** in one platform.

---

# 🚀 Key Features

## 1. 🎙️ Real-Time Classroom Translation

A teacher can speak during a live class.

```text
Teacher speaks
      ↓
Speech-to-Text
      ↓
Translation Layer
      ↓
Teacher Review (when required)
      ↓
Student's Language
      ↓
Student Screen
```

The live classroom uses a WebSocket room so translated content can be pushed to connected students in real time.

**Implementation:**

- Backend: `backend/app/routers/live.py`
- Teacher UI: `frontend/src/pages/teacher/Live.jsx`
- Student UI: `frontend/src/pages/student/LiveClass.jsx`

---

## 2. 🌱 Adaptive Mother-Tongue Lessons

Lessons can be localized according to the learner's selected language.

The platform can use:

- Existing verified translations
- Translation memory
- External translation services when configured
- Teacher-authored translations
- Content requiring teacher review

**Implementation:**

```text
backend/app/routers/learn.py
backend/app/services/analytics.py
```

---

## 3. 📱 Offline-First PWA

Shiksha Vani is designed for environments where internet connectivity may be unreliable.

The frontend uses a Progressive Web App architecture with:

- Service worker caching
- IndexedDB
- Offline lesson access
- Local answer storage
- Event/sync queue
- Automatic synchronization when connectivity returns

```text
              INTERNET AVAILABLE
                     ↑
                     │
Student App → IndexedDB → Sync Queue → /api/sync
      │
      └── Works offline
```

This allows learners to continue using important parts of the application even when the network is temporarily unavailable.

---

## 4. 🌐 Multi-Language / Multi-Dialect Support

The project includes a language registry and translation-status system.

The platform is designed to distinguish between:

- `DRAFT`
- `VERIFIED`
- `MISSING`

This is important because vernacular educational content should not be treated as correct merely because an automated system generated it.

Teachers can review and approve translations before they become reusable verified content.

---

## 5. 👨‍👩‍👧 Parent–Teacher Bridge

Shiksha Vani connects teachers and parents through a dedicated parent experience.

Features include:

- Student progress visibility
- Parent–teacher messages
- Automatic message translation
- Parent-language support
- Learning updates

**Implementation:**

```text
frontend/src/pages/parent/Home.jsx
backend/app/routers/parent.py
```

---

## 6. 🗣️ Reading & Speech Practice

Students can practice reading and receive word-level scoring.

The system uses browser speech capabilities where available and can optionally connect to server-side speech services.

**Implementation:**

```text
frontend/src/pages/student/Practice.jsx
frontend/src/lib/speech.js
backend/app/services/speech.py
```

---

## 7. 📊 Teacher Dashboard & Early Warnings

Teachers receive learning insights instead of having to manually inspect every learner's activity.

The analytics service currently includes **five alert rules**, each associated with a suggested teacher action.

The dashboard can help surface learners who may require additional attention based on learning activity and available signals.

**Implementation:**

```text
frontend/src/pages/teacher/Overview.jsx
backend/app/services/analytics.py
```

> These alerts are intended as decision-support signals for teachers, not as automatic diagnoses or definitive judgments about a child.

---

## 8. 📚 Vernacular Library & Bhasha Kosh

The platform includes a vernacular content layer with:

- Lessons
- Community dictionary
- Word bank
- Voice recordings
- Translation status
- Teacher review

This creates the foundation for a growing, community-supported language resource.

---

## 9. 🤖 AI Tutor

Shiksha Vani can optionally connect to an AI tutor.

When an external AI service is not configured, the application can fall back to lesson-text-based retrieval so the basic tutor experience can still work without an external AI API.

Optional Claude integration is configured through:

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

---

## 10. 🔄 Teacher-in-the-Loop Translation

Automated translation is treated as a **draft**, not automatically as authoritative educational content.

```text
Translation generated
        ↓
      DRAFT
        ↓
Teacher reviews
   ↙          ↘
Edit          Approve
 ↓              ↓
VERIFIED ←──────┘
        ↓
Reusable translation memory
```

This approach helps reduce the risk of incorrect vernacular content being repeatedly propagated.

---

# 🧠 Translation Architecture

The translation service follows a layered strategy:

```text
Input sentence
      │
      ▼
1. Exact translation-memory match
      │
      ├── Found → Reuse
      │
      ▼
2. Bhashini (when configured)
      │
      ▼
3. Optional public MT
   for configured languages
      │
      ▼
4. Closest saved sentence
   (teacher console only)
      │
      ▼
5. No suitable result
      │
      ▼
   Mark as MISSING
```

External translation results are stored as **DRAFT** content and can be reviewed by teachers.

The similarity-based fallback uses **TF-IDF cosine similarity** over the available translation memory.

Implementation:

```text
backend/app/services/translation.py
backend/app/services/bhashini.py
backend/app/languages.py
```

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │      Teacher App     │
                         │  Voice / Live Class  │
                         └──────────┬───────────┘
                                    │
                              WebSocket / API
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     FastAPI Server   │
                         │                      │
                         │ Auth • Lessons      │
                         │ Live • Parent       │
                         │ Analytics • Speech  │
                         │ Translation • Tutor │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
             Translation       Analytics          AI Tutor
                Layer             Layer             Layer
                    │
                    ▼
             ┌───────────────┐
             │ Verified /    │
             │ Draft Content │
             └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │ Student PWA   │
             │               │
             │ Lessons       │
             │ Practice      │
             │ Live Class    │
             └───────┬───────┘
                     │
                IndexedDB
                     │
              Offline Queue
                     │
              Online Sync
                     ▼
                /api/sync

                     │
                     ▼
             ┌───────────────┐
             │ Parent App    │
             │ Progress      │
             │ Messages      │
             └───────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | User interface |
| Vite | Development/build tooling |
| JavaScript | Application logic |
| PWA | Installable/offline application |
| IndexedDB | Offline data storage |
| WebSocket | Real-time classroom communication |

## Backend

| Technology | Purpose |
|---|---|
| Python | Backend language |
| FastAPI | REST API and WebSocket server |
| Uvicorn | ASGI server |
| Pytest | Backend testing |

## AI / Language Layer

| Technology | Purpose |
|---|---|
| Bhashini / ULCA | Optional vernacular translation and speech services |
| Claude | Optional AI tutor |
| Whisper-compatible endpoint | Optional server-side speech recognition |
| TF-IDF + cosine similarity | Translation-memory matching |

## Deployment / Infrastructure

| Technology | Purpose |
|---|---|
| Docker | Containerization |
| Docker Compose | Multi-service local/deployment setup |
| PostgreSQL | Optional production database |
| Redis | Future scaling option for live-class rooms |

---

# 📁 Project Structure

```text
shiksha-vani/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── seed.py
│   │   ├── content.py
│   │   ├── languages.py
│   │   ├── security.py
│   │   │
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── learn.py
│   │   │   ├── student.py
│   │   │   ├── teacher.py
│   │   │   ├── parent.py
│   │   │   └── live.py
│   │   │
│   │   └── services/
│   │       ├── translation.py
│   │       ├── bhashini.py
│   │       ├── speech.py
│   │       ├── analytics.py
│   │       ├── tutor.py
│   │       ├── reports.py
│   │       └── text.py
│   │
│   └── tests/
│       └── test_api.py
│
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       ├── lib/
│       │   ├── api.js
│       │   ├── session.jsx
│       │   ├── store.js
│       │   ├── speech.js
│       │   ├── ws.js
│       │   └── i18n.js
│       │
│       └── pages/
│           ├── student/
│           ├── teacher/
│           └── parent/
│
├── docs/
│   ├── DEMO_SCRIPT.md
│   └── screenshots/
│
├── .gitignore
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# ⚡ Quick Start

## Requirements

Install:

- Python **3.10+**
- Node.js **18+**
- npm
- Git

---

## 1. Clone the repository

```bash
git clone https://github.com/Nandish344/Shiksha-Vani_7.git
cd Shiksha-Vani_7
```

---

## 2. Start the Backend

### Windows

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create your environment file:

```powershell
copy .env.example .env
```

Start FastAPI:

```powershell
uvicorn app.main:app --reload --port 8000
```

### Linux / macOS

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The backend runs at:

```text
http://localhost:8000
```

Demo data is seeded automatically on first startup.

---

## 3. Start the Frontend

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:

```text
http://localhost:5173
```

Open the URL in your browser.

---

# 👤 Demo Accounts

The project includes demo accounts for testing different user experiences.

| Role | Username | Password |
|---|---|---|
| Teacher | `teacher` | `demo123` |
| Parent | `parent` | `demo123` |
| Student | `sona` | `demo123` |
| Student | `anita` | `demo123` |
| Student | `birsa` | `demo123` |
| Student | `sunita` | `demo123` |

From the application, select:

```text
Student / Teacher / Parent
```

and sign in using the appropriate demo account.

---

# 🐳 Docker

To run the application using Docker:

```bash
docker compose up --build
```

---

# 📦 Production / Single-Server Build

Build the frontend:

```bash
cd frontend
npm run build
```

The backend can serve the generated frontend from:

```text
frontend/dist
```

The combined application can then be accessed through:

```text
http://localhost:8000
```

---

# 🧪 Testing

Run the backend test suite:

```bash
cd backend
pytest -q
```

The project currently contains **19 tests**, including coverage for the WebSocket live-class flow.

---

# 🔌 Optional AI & External Services

The core application can run without external AI credentials.

Additional capabilities can be enabled through `backend/.env`.

## Bhashini

Configure:

```env
BHASHINI_USER_ID=
BHASHINI_API_KEY=
```

Optional language-code overrides:

```env
BHASHINI_CODE_OVERRIDES="unr=mun"
```

Use the application's content-review workflow to inspect translation drafts.

> Verify current Bhashini catalogue/language support before presenting specific language coverage as a confirmed production capability.

---

## AI Tutor

Configure:

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

Without an external AI key, the tutor can use lesson-text retrieval.

---

## Server Speech Recognition

For languages unsupported by browser speech recognition, an optional Bhashini ASR or OpenAI-compatible Whisper endpoint can be configured:

```env
WHISPER_API_URL=
```

---

## PostgreSQL

For a PostgreSQL deployment:

```env
DATABASE_URL=postgresql+psycopg://user:pass@host/db
```

Install the PostgreSQL driver:

```bash
pip install "psycopg[binary]"
```

---

# 🗺️ Feature-to-Code Mapping

| Feature | Main Implementation |
|---|---|
| Real-time translation | `backend/app/routers/live.py` |
| Teacher live console | `frontend/src/pages/teacher/Live.jsx` |
| Student live class | `frontend/src/pages/student/LiveClass.jsx` |
| Adaptive lessons | `backend/app/routers/learn.py` |
| Learning recommendations | `backend/app/services/analytics.py` |
| Offline PWA | `vite-plugin-pwa`, IndexedDB |
| Offline API/sync | `frontend/src/lib/api.js`, `session.jsx` |
| Sync endpoint | `/api/sync` |
| Parent dashboard | `frontend/src/pages/parent/Home.jsx` |
| Parent communication | `backend/app/routers/parent.py` |
| Speech practice | `frontend/src/pages/student/Practice.jsx` |
| Speech processing | `backend/app/services/speech.py` |
| Teacher analytics | `frontend/src/pages/teacher/Overview.jsx` |
| Translation engine | `backend/app/services/translation.py` |
| AI tutor | `backend/app/services/tutor.py` |
| Reports | `backend/app/services/reports.py` |
| PDF/print report | `frontend/src/pages/teacher/PrintReport.jsx` |
| CSV export | Teacher reporting workflow |
| Vernacular dictionary | Bhasha Kosh / language content layer |

---

# 🔐 Data, Privacy & Security

The current project is a **demonstration/prototype build**.

Before a real school deployment:

- Disable `DEMO_MODE`
- Set a strong `JWT_SECRET`
- Add authentication hardening
- Add rate limiting
- Secure API credentials
- Review database access controls
- Implement appropriate logging and monitoring
- Review children's data handling and consent requirements
- Conduct a privacy/security review before a real pilot

The application should not be considered production-ready solely because the demo works.

---

# ⚠️ Important Limitations

## 1. Vernacular content requires native-speaker validation

The seeded Santali, Mundari, Ho and Kurukh content is currently **draft content**.

Some words were created from general knowledge for demonstration purposes and must be reviewed by native speakers before being presented as authoritative educational content.

The system intentionally uses translation states such as:

```text
DRAFT → Teacher Review → VERIFIED
```

Kurukh currently has fewer seeded entries by design.

Whole-sentence tribal translation is **not fabricated** when no suitable translation is available. In such cases, the application can show the source-language content with a clear notice.

---

## 2. Some external integrations are optional / untested in the local build

The following integrations require external credentials or services:

- Bhashini translation
- Bhashini/Whisper speech recognition
- Claude AI tutor
- PostgreSQL
- Docker deployment

The core local application and its demonstrated workflows do not depend on all of these services.

---

## 3. Browser speech capabilities vary

Speech recognition and text-to-speech depend partly on the browser's available engines.

Chrome on Android/desktop provides the primary tested browser experience.

There is no assumption that browsers provide native Santali TTS/ASR.

---

## 4. Live classroom rooms currently use in-process memory

The current WebSocket room implementation is suitable for the prototype/demo environment.

For multi-server production deployment, a shared messaging layer such as Redis pub/sub should be introduced.

---

## 5. DIKSHA / Adi Vaani

These integrations are not currently implemented.

The translation/content architecture is designed so that such integrations can be added later.

---

# 🧩 What Makes the Architecture Different

Shiksha Vani is designed around several principles:

### Offline-first

Learning should not stop simply because connectivity temporarily disappears.

### Human-in-the-loop

Automated translation is treated as a draft when human verification is required.

### Mother-tongue-first learning

Language is treated as part of the learning experience rather than only a translation setting.

### Teacher decision support

Analytics highlight signals that may deserve teacher attention rather than automatically labeling students.

### Extensible AI layer

External AI services can be connected when available without making every core application workflow dependent on them.

---

# 🧪 Demonstration Flow

A typical SIH demonstration can follow this sequence:

```text
1. Teacher logs in
        ↓
2. Opens Live Class
        ↓
3. Teacher speaks a sentence
        ↓
4. Speech converted to text
        ↓
5. Translation layer processes sentence
        ↓
6. Translation is displayed / reviewed
        ↓
7. Student receives localized content
        ↓
8. Student answers or practices reading
        ↓
9. Learning activity is recorded
        ↓
10. Teacher dashboard receives learning signals
        ↓
11. Parent can view progress / communication
        ↓
12. Offline activity synchronizes when connectivity returns
```

---

# 📈 Future Roadmap

Potential next-stage improvements include:

- Native-speaker verified vernacular datasets
- Expanded language and dialect coverage
- More robust Bhashini integration
- Improved ASR/TTS for Indian languages
- Redis-backed scalable live classrooms
- Production PostgreSQL deployment
- Stronger authentication and authorization
- Privacy-preserving student analytics
- Advanced personalized learning recommendations
- DIKSHA integration
- Adi Vaani integration
- Teacher content authoring tools
- Community moderation for the vernacular dictionary
- More comprehensive accessibility features

---

# 👥 Team

**Team Brute Force — Smart India Hackathon 2026**

**Project:** Shiksha Vani  
**Problem Statement:** SIH26042  
**Theme:** AI-powered vernacular pedagogy and real-time translation for mother-tongue primary education

---

# 📄 Documentation

Additional project documentation is available in:

```text
docs/
```

including:

```text
docs/DEMO_SCRIPT.md
docs/screenshots/
```

---

# 📜 Project Status

**Prototype / SIH 2026 Demonstration Build**

The project demonstrates the end-to-end architecture and core workflows while clearly identifying integrations and language content that require further validation before real-world deployment.

---

## ❤️ Built for Accessible, Mother-Tongue Learning

> **Shiksha Vani — making language a bridge to learning, not a barrier.**
