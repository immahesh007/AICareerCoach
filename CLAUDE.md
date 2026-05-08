# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Resume + Job Match Coach — users upload a resume, paste a job description, and get an ATS score with strengths/weaknesses, missing keywords, formatting feedback, and a match report. A separate resume-builder flow generates a LaTeX-rendered PDF from structured input. Authenticated users see a dashboard of their resumes and past analyses; guest uploads are supported and can be "claimed" on signup.

## Running the Project

Two supported workflows: full-stack via Docker Compose, or each service locally for fast iteration.

### Docker Compose (full stack)
```bash
cp backend/.env.example backend/.env   # fill AWS / JWT secrets
docker compose up --build
```
Spins up four containers: `db` (Postgres 16), `backend` (FastAPI :8000), `resume-builder-service` (xelatex :8080), `frontend` (Next.js :3000). Backend `entrypoint.sh` runs migrations and pre-loads the BGE-M3 embedding model before `uvicorn` starts.

Compose overrides two env vars from `backend/.env`:
- `DATABASE_URL` → points at the `db` service
- `OLLAMA_BASE_URL` → `http://host.docker.internal:11434` (Ollama runs on the **host**, not in a container — start `ollama serve` separately)

### Local development (no Docker)
```bash
brew services start postgresql@16
psql -U immahesh -d aicareercoach   # verify DB
ollama serve                         # required for parsing / ATS / JD endpoints

# Backend — must run from backend/ (top-level packages: core, db, routes, services)
cd backend
pip install -r requirements.txt
cp .env.example .env
python migrate.py              # apply all SQL migrations
uvicorn main:app --reload --port 8000

# Resume builder service — requires xelatex installed locally
cd resume-builder-service
pip install -r requirements.txt
uvicorn main:app --port 8080

# Frontend
cd frontend
npm install && npm run dev     # http://localhost:3000
```
API docs: `http://localhost:8000/docs`. Migrations are idempotent and applied in filename order by `backend/migrate.py`.

## Architecture

### Three-service structure
- **`frontend/`** — Next.js 14 App Router + Tailwind. `next.config.js` rewrites `/api/*` → `${BACKEND_URL}/api/*` (defaults to `localhost:8000`), so the browser never makes cross-origin calls and no CORS config is needed client-side.
- **`backend/`** — FastAPI + async SQLAlchemy (`asyncpg`) + aioboto3. Orchestrates parsing, embedding, LLM, S3, and the resume-builder microservice. Must run from `backend/` because `core/`, `db/`, `routes/`, `services/` are imported as top-level packages.
- **`resume-builder-service/`** — Standalone FastAPI on :8080. Single endpoint `POST /generate` renders a Jinja2 LaTeX template (`templates/resume.tex.j2`) and shells out to `xelatex` to return a PDF. Stateless, no DB.

### Backend request flows

**Upload** (`POST /api/upload-resume`, unauthenticated allowed):
```
routes/resume.py        validate type/ext, resolve user_id (JWT > X-User-Id > query > guest_xxxxxx)
  → services/file_service.py
       create_pending row → S3 upload → update_success
       (best-effort) extract_text → llm_service.extract_resume_data → insert_parsed (savepoint)
```

**ATS analysis** (`POST /api/know-ats`, JWT required):
```
routes/ats.py           ownership check via resume.user_id == current_user_id (404 on mismatch)
  → llm_service.extract_jd_data           (Ollama → parsed JD JSON)
  → update_parsed_jd                      (cached on the parsed_resumes row)
  → services/ats_service.compute_ats_score
       BGE-M3 cosine similarity (semantic_score)
       + llm_service.evaluate_ats_match   (LLM gets resume + JD + semantic_score)
       → ats_evaluations row
```

**Dashboard** (`GET /api/resumes`, JWT required):
A single LATERAL JOIN in `resume_repo.list_resumes_with_latest_score` returns each resume with its newest `ats_score` in one trip — do not replace with N+1 fetches. Only `status='SUCCESS'` resumes are listed.

**Resume builder** (`POST /api/resume-builder/generate`):
Backend forwards JSON to `RESUME_BUILDER_SERVICE_URL/generate`, gets a PDF back, uploads to S3 under `generated-resumes/{user_id}/{uuid}.pdf`, and returns a presigned URL.

### Identity / auth model

Three identity tiers, resolved in order:
1. **JWT** (`Authorization: Bearer <token>`) — issued by `/api/auth/register` and `/api/auth/login`. `core/auth_dep.get_current_user_id` makes routes auth-required; `get_optional_user_id` lets the upload route prefer JWT but fall through.
2. **`X-User-Id` header** — guest fallback for the upload and resume-builder routes only. **Ignored when a valid JWT is present** (see `routes/resume.py`).
3. **Auto-generated `guest_<6-hex>`** — minted in `file_service._resolve_user_id` when nothing else is provided. The frontend stashes this in `localStorage.guest_id`.

**Guest claim flow:** when a guest registers or logs in, they may submit their `guest_id` in the request body. `user_repo.claim_guest_resumes` re-assigns all their `resume_metadata.user_id = guest_xxxxxx` rows to the new `users.id` UUID. The regex `^guest_[a-f0-9]{6}$` is enforced server-side; malformed IDs are silently dropped. The frontend clears `localStorage.guest_id` on successful login.

**Ownership checks return 404, not 403** — never leak existence of other users' resources. See `routes/ats.py` and `routes/dashboard.py`.

### Upload status lifecycle
`resume_metadata.status`: `PENDING` (row created before S3) → `SUCCESS` (S3 confirmed, `s3_key` set) or `FAILED` (S3 exception, `s3_key` stays NULL). On S3 failure the service calls `await db.commit()` **explicitly** before raising — without this, `get_db`'s exception rollback would erase the `FAILED` status.

### Parsing pipeline isolation
`file_service.save_upload` wraps the parsing block (text extraction → LLM → `insert_parsed`) in `db.begin_nested()` (a SAVEPOINT). A parsing or LLM failure rolls back only the parsed-resume insert; the upload itself remains `SUCCESS`. Parsing is best-effort — clients get a usable `file_id` even if Ollama is down.

## AI / ML layer

- **LLM**: Ollama (`llama3.2` by default), called from `services/llm_service.py` using the official `ollama` Python `AsyncClient` with `format="json"` to force valid JSON. Three prompt families: resume parsing, JD parsing, ATS evaluation. Falls back gracefully (`{}` or vector-only score) if the model returns invalid JSON.
- **Embeddings**: `BAAI/bge-m3` via `sentence-transformers`, lazy-loaded with `lru_cache(maxsize=1)` in `ats_service._get_model`. Pre-warmed by `entrypoint.sh` on Docker boot to avoid a multi-second cold-start on the first ATS request.
- **Encoding** runs in a thread pool (`run_in_executor`) so the async event loop isn't blocked.
- **Hybrid score**: cosine similarity of BGE-M3 embeddings is fed *into* the LLM as `semantic_score` so the model can use it as a quantitative signal alongside its qualitative judgment.
- **Free-text coercion**: the LLM occasionally returns dicts/lists for fields the schema asks for as strings (e.g. `formatting_feedback` bucketed by check). `ats_service._coerce_text` flattens these so TEXT columns accept them — keep this when adding new free-text fields.

## Data model

Six tables (see `db/models.py` and `migrations/`):
- `resume_metadata` — uploaded files (status lifecycle, S3 key, original filename).
- `parsed_resumes` — one row per resume with `parsed_data` (JSONB) from the LLM and an inline `parsed_jd` column updated when ATS runs (no separate JD table).
- `ats_evaluations` — many-per-resume; each ATS analysis is a new row. Includes `jd_text` and `jd_title` for dashboard display.
- `users`, `login_history` — auth.

`user_id` columns on resume_metadata / parsed_resumes are `Text` (not FK) because guest IDs (`guest_xxxxxx`) coexist with real `users.id` UUIDs in the same column. The claim flow rewrites guest IDs to UUID strings on login.

## Key Configuration

### Backend environment (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://...    # must use +asyncpg dialect, not plain postgresql://
AWS_ACCESS_KEY_ID=...                    # required (no IAM role assumption in code)
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=...
OLLAMA_BASE_URL=http://localhost:11434   # docker-compose overrides to host.docker.internal
OLLAMA_MODEL=llama3.2
JWT_SECRET_KEY=change-me-in-production
JWT_EXPIRE_MINUTES=1440
RESUME_BUILDER_SERVICE_URL=http://localhost:8080
```
`pydantic-settings` resolves `.env` relative to the process CWD — always start `uvicorn` from `backend/`.

### S3 key formats
- Uploaded resumes: `resumes/{user_id}/{file_id}.{ext}`
- Generated resumes: `generated-resumes/{user_id}/{uuid}.pdf`
- Presigned URLs default to **15 minutes** (`PRESIGNED_URL_TTL` in `routes/dashboard.py`).

### SQLAlchemy async constraints (don't change without reason)
- `expire_on_commit=False` on `AsyncSessionLocal` — prevents `MissingGreenlet` errors when accessing ORM attributes after commit.
- `create_type=False` on the `ResumeStatus` Enum column — the migration SQL owns the `resume_status_enum` Postgres type; SQLAlchemy must not try to recreate it.

### LaTeX template gotcha
`resume-builder-service/main.py` uses **custom Jinja2 delimiters** so they don't collide with LaTeX braces:
- Variables: `<< var >>`
- Blocks: `<% if %> ... <% endif %>`
- Comments: `<# comment #>`

All user-supplied strings must be passed through the `| e` filter (LaTeX special-char escape). The Dockerfile installs `texlive-xetex` + CMU/Noto-emoji fonts; `xelatex` is required (not `pdflatex`) for the font set. Build failures return the LaTeX `.log` as 500 body for debugging.

## Frontend conventions

- **Auth state**: `context/AuthContext.tsx` reads `auth_token` + `auth_user` from `localStorage` on mount. All authed services attach `Authorization: Bearer <token>` from localStorage directly (see `services/dashboardService.authHeaders`) — there is no axios interceptor.
- **Upload component**: `components/UploadArea.tsx` is `'use client'`, manages `idle | dragging | uploading | success | error` phases. `services/uploadService.ts` uses `XMLHttpRequest` (not `fetch`) so it can report progress via `xhr.upload.onprogress`.
- **Client-side validation**: file type + 10 MB limit checked in `utils/fileValidation.ts` before any network call. Server enforces the same limit (`MAX_SIZE` in `file_service.py`) — keep them in sync.
- **Routes**: `/` (landing), `/dashboard` (resume list), `/ats-dashboard` (ATS analysis view), `/resumes/[id]` (per-resume analyses), `/resume-builder` (LaTeX form).
- **Path alias**: `@/*` → project root (see `tsconfig.json`).
