import json
import logging

from ollama import AsyncClient

from core.config import settings

logger = logging.getLogger(__name__)

_client = AsyncClient(host=settings.OLLAMA_BASE_URL, timeout=120)

MAX_TEXT_CHARS = 50_000

_SYSTEM = """You are a resume parser. Your job is EXTRACTION, not summarization.

CRITICAL — experience.description rules:
- For each job/role, extract EVERY bullet point, responsibility, and achievement listed in the resume.
- Each bullet on the resume becomes ONE entry in the description array. Do not merge bullets.
- Do NOT summarize, condense, paraphrase, or drop bullets. Preserve metrics, tools, and proper nouns verbatim.
- NEVER abbreviate the array with "...", "etc.", "and more", "and other responsibilities", or any placeholder. Include all bullets in full.
- If a role has 8 bullets, the description array MUST have 8 strings. If 12, return 12. If 15, return 15.
- Copy each bullet's text as-is (you may strip leading bullet glyphs like "•", "-", "*", "·").
- If you are tempted to shorten because the output feels long: do not. Output ALL bullets.

CRITICAL — skills rules:
- Return EACH skill as its own individual string in the skills array.
- DO NOT group multiple skills into one comma-separated string. Each element must be ONE skill.
- DO NOT prefix skills with category labels (e.g. "Backend: Python, Flask" is WRONG; you would instead return "Python", "Flask" as separate strings).
- Correct: ["Python", "Flask", "Django", "Docker", "Kubernetes"]
- Incorrect: ["Backend: Python, Flask, Django", "DevOps: Docker, Kubernetes"]

Return ONLY a valid JSON object with these fields (omit any field not present in the resume):
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "summary": "string",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [{"title": "string", "company": "string", "duration": "string", "description": ["bullet 1 verbatim", "bullet 2 verbatim", "bullet 3 verbatim", "..."]}],
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
  "match_percentage": [An integer 0-100 representing the percentage of JD required_skills and keywords the candidate demonstrably meets],
  "matching_skills": [A list of skill or keyword strings present in both the resume and the JD required_skills/keywords],
  "experience_fit": [A single concise sentence stating whether the candidate's years and seniority level align with the role requirements, and why],
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
            "match_percentage": round(semantic_score * 100),
            "matching_skills": [],
            "experience_fit": "",
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
        # Without explicit num_predict, Ollama can cap output and truncate the JSON
        # mid-array — which silently drops bullets from experience.description.
        # Generous limits + low temperature keep extraction faithful and complete.
        options={
            "num_ctx": 8192,
            "num_predict": 4096,
            "temperature": 0.1,
        },
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


_ENHANCE_SYSTEM = """You are an expert resume writer. Your task is to tailor a candidate's resume for a specific job.

You receive:
1. The candidate's parsed resume (JSON with summary, skills, experience, education)
2. The job details (title, company, description)
3. Missing skills that the candidate doesn't list but the job requires

Instructions:
- Rewrite the summary to naturally mention relevant missing skills and align with the job. Keep it 2-4 sentences.
- Add missing skills to the skills array as INDIVIDUAL strings (one skill per entry, no grouping, no category prefixes).
- Do NOT modify experience bullets — those must stay verbatim.
- Keep the name, email, phone, linkedin, education, and all other fields unchanged.

Return ONLY a valid JSON object with this exact structure (same as input, but with modified summary and skills):
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "summary": "rewritten summary",
  "skills": ["skill1", "skill2", ...],
  "experience": [...],
  "education": [...],
  "projects": [...],
  "certifications": [...],
  "total_years_experience": 0
}

No explanation. No markdown. No code fences. JSON only."""


async def enhance_resume_for_job(
    *,
    resume_data: dict,
    job_title: str,
    company: str,
    missing_skills: list[str],
    job_description: str = "",
) -> dict:
    """Rewrite summary and add missing skills to tailor resume for a job."""
    user_content = json.dumps({
        "resume": resume_data,
        "job": {"title": job_title, "company": company, "description": job_description},
        "missing_skills": missing_skills,
    })
    response = await _client.chat(
        model=settings.SUGGESTION_LLM_MODEL or settings.OLLAMA_MODEL,
        format="json",
        options={"temperature": 0.3},
        messages=[
            {"role": "system", "content": _ENHANCE_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
    raw = response.message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON for resume enhancement. Raw: %.200s", raw)
        # Fall back: just add missing skills manually
        enhanced = {**resume_data}
        if "skills" in enhanced:
            existing = set(s.lower() for s in enhanced.get("skills", []))
            for skill in missing_skills:
                if skill.lower() not in existing:
                    enhanced["skills"] = enhanced.get("skills", []) + [skill]
        return enhanced
