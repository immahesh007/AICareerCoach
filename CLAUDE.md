# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Resume + Job Match Coach — an AI-powered platform where users upload a resume and receive ATS scoring, job-description match analysis, resume tailoring suggestions, skill gap identification, and interview prep. Current MVP implements resume upload with S3 storage and PostgreSQL persistence; AI analysis layers are planned for future phases.

## Running the Project

### Prerequisites
```bash
brew services start postgresql@16
psql -U immahesh -d aicareercoach   # verify DB connection
```

### Backend (FastAPI)
Run from inside the `backend/` directory — all imports are relative to it:
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in real values
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### Database migration
```bash
psql -U immahesh -d aicareercoach -f backend/migrations/001_create_resume_metadata.sql
```
Migration is idempotent — safe to re-run.

## Architecture

### Two-service structure
- **`frontend/`** — Next.js 14 App Router + Tailwind CSS. All `/api/*` calls are rewritten by `next.config.js` to `http://localhost:8000/api/*`, so no CORS config is needed in the browser.
- **`backend/`** — FastAPI with async SQLAlchemy (asyncpg driver) + aioboto3 for S3. Must be run from `backend/` because `core/`, `db/`, `routes/`, and `services/` are resolved as top-level packages.

### Backend request flow
```
routes/resume.py          ← validates file type; extracts user_id from header/query
    ↓
services/file_service.py  ← orchestrates: read bytes → resolve user_id → DB → S3 → DB
    ↓ (parallel)
db/repositories/resume_repo.py   ← create_pending / update_success / update_failed
services/s3_service.py           ← aioboto3 put_object
```

`get_db` (in `db/connection.py`) commits on clean return and rolls back on exception. The S3-failure path calls `await db.commit()` explicitly before raising `HTTPException` to preserve the `FAILED` status — without this the rollback would erase it.

### User identity
`user_id` resolution order: `X-User-Id` header → `?user_id=` query param → auto-generated `guest_<6-char-uuid-suffix>`. Unauthenticated uploads are fully supported.

### Upload status lifecycle
`resume_metadata.status` transitions: `PENDING` (row inserted before S3 upload) → `SUCCESS` (S3 confirmed) or `FAILED` (S3 exception). The `s3_key` column is `NULL` while `PENDING` or `FAILED`.

### Frontend upload component
`frontend/components/UploadArea.tsx` is a `'use client'` component managing four visual phases (`idle`, `dragging`, `uploading`, `success`/`error`). It calls `frontend/services/uploadService.ts` which uses `XMLHttpRequest` (not `fetch`) to report upload progress. File type + 10 MB size validation happens client-side in `frontend/utils/fileValidation.ts` before any network call.

## Key Configuration

### Backend environment (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://...   # must use +asyncpg dialect — not plain postgresql://
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=...
```
Settings are loaded by `core/config.py` via `pydantic-settings`. The `.env` file is resolved relative to the process working directory, so `uvicorn` must be started from `backend/`.

### S3 key format
`resumes/{user_id}/{file_id}.{ext}` — structured for per-user S3 lifecycle policies.

### SQLAlchemy async constraints
- `expire_on_commit=False` on `AsyncSessionLocal` — required to prevent `MissingGreenlet` errors when accessing ORM attributes after commit.
- `create_type=False` on the `ResumeStatus` Enum column — the migration SQL owns the `resume_status_enum` PostgreSQL type; SQLAlchemy must not try to create it.

## Planned Tech Stack (not yet implemented)
Per README: OpenAI/Claude/Llama for LLM layer, Sentence Transformers + BGE embeddings for job matching, PyMuPDF + python-docx for parsing, Redis for caching.


Graphify
graphify update ./src