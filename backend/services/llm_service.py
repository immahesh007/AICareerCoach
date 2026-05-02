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


_ATS_SYSTEM = """You are a Senior Technical Recruiter and ATS Optimization Expert with 15 years of experience evaluating resumes.

You receive three inputs:
1. A parsed resume (JSON)
2. A parsed job description (JSON)
3. A semantic_score (0.0–1.0) from a vector similarity model

**Instructions:**
1. List all required skills from the JD and internally rate the candidate's match for each from 0-10 based on the resume.
2. Verify the 'Experience Level' match (does the candidate's chronology align with the required years of experience?).
3. Evaluate structural formatting. Because you are evaluating JSON, ignore visual layout (fonts/margins) and focus purely on structural readability:
   * Density Check: Flag bullet points that are excessively long (recommend 2 lines max).
   * Chronology Check: Identify any employment gaps (e.g., a 6-month gap) and suggest adding a brief note or project to fill it.
   * Contact Audit: Verify the presence of standard contact info (phone number, email, location) required for modern ATS mapping.

**Output Generation:**
You must return your analysis strictly as a valid JSON object matching the following schema. Do not include markdown formatting or conversational text outside the JSON.

{
  "ats_score": [A final weighted integer from 0-100 combining skill match, experience match, and keyword presence],
  "strengths": [A list of 3 strings detailing the candidate's top competitive advantages for this specific role],
  "weaknesses": [A list of strings detailing sections that lack depth, require more quantification, or fall short of the JD],
  "missing_keywords": [A list of specific tools, skills, or terminologies from the JD that are entirely absent from the resume],
  "formatting_feedback": [A concise paragraph containing your Density, Chronology, and Contact structural checks],
  "match_report": [A brief, punchy 2-sentence executive summary of the candidate's overall fit for the hiring manager]
}

Consider: skill overlap, years of experience match, keyword alignment, education fit.
Use semantic_score as a quantitative signal; apply recruiter judgment for the final ats_score.
No explanation. No markdown. JSON only."""


async def evaluate_ats_match(
    *,
    resume_data: dict,
    jd_data: dict,
    semantic_score: float,
) -> dict:
    user_content = json.dumps(
        {
            "resume": resume_data,
            "job_description": jd_data,
            "semantic_score": round(semantic_score, 4),
        },
        ensure_ascii=False,
    )
    response = await _client.chat(
        model=settings.OLLAMA_MODEL,
        format="json",
        messages=[
            {"role": "system", "content": _ATS_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
    raw = response.message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON for ATS eval. Raw: %.200s", raw)
        return {
            "ats_score": round(semantic_score * 100),
            "strengths": [],
            "weaknesses": [],
            "missing_keywords": [],
            "formatting_feedback": "",
            "match_report": "Vector-only scoring; LLM evaluation unavailable.",
        }


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
