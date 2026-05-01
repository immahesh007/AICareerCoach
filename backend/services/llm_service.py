import json
import logging

from ollama import AsyncClient

from core.config import settings

logger = logging.getLogger(__name__)

_client = AsyncClient(host=settings.OLLAMA_BASE_URL)

MAX_TEXT_CHARS = 50_000

_SYSTEM = """You are a resume parser. Extract structured information from resume text.

Return ONLY a valid JSON object with these fields (omit any field not present in the resume):
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "summary": "string",
  "skills": ["string"],
  "experience": [{"title": "string", "company": "string", "duration": "string", "description": "string"}],
  "education": [{"degree": "string", "institution": "string", "year": "string"}],
  "projects": [{"name": "string", "description": "string", "technologies": ["string"]}],
  "certifications": ["string"],
  "total_years_experience": 0
}

No explanation. No markdown. No code fences. JSON only."""


_JD_SYSTEM = """You are a job description parser. Extract structured information.

Return ONLY a valid JSON object with these fields (omit any not present):
{
  "job_title": "string",
  "company": "string",
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "experience_years": 0,
  "education_requirements": "string",
  "responsibilities": ["string"],
  "keywords": ["string"]
}

No explanation. No markdown. No code fences. JSON only."""


async def extract_jd_data(raw_text: str) -> dict:
    text = raw_text[:MAX_TEXT_CHARS]
    if len(raw_text) > MAX_TEXT_CHARS:
        logger.warning("JD text truncated from %d to %d chars for LLM", len(raw_text), MAX_TEXT_CHARS)

    response = await _client.chat(
        model=settings.OLLAMA_MODEL,
        format="json",
        messages=[
            {"role": "system", "content": _JD_SYSTEM},
            {"role": "user", "content": f"Parse this job description:\n\n{text}"},
        ],
    )

    raw = response.message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Ollama returned non-JSON for JD; returning empty dict. Raw: %.200s", raw)
        return {}


async def extract_resume_data(raw_text: str) -> dict:
    text = raw_text[:MAX_TEXT_CHARS]
    if len(raw_text) > MAX_TEXT_CHARS:
        logger.warning("Resume text truncated from %d to %d chars for LLM", len(raw_text), MAX_TEXT_CHARS)

    response = await _client.chat(
        model=settings.OLLAMA_MODEL,
        format="json",  # forces the model to output valid JSON
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"Parse this resume:\n\n{text}"},
        ],
    )

    raw = response.message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Ollama returned non-JSON output; returning empty dict. Raw: %.200s", raw)
        return {}
