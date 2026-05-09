"""Generate approve/reject-able resume modification suggestions from an ATS evaluation.

Three buckets only: summary, skills, experience. Suggestions are stateless — the
endpoint regenerates on demand and the frontend persists user decisions client-side.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from ollama import AsyncClient

from core.config import settings
from services.ats_service import _coerce_text

logger = logging.getLogger(__name__)

_client = AsyncClient(host=settings.OLLAMA_BASE_URL, timeout=180)

_SYSTEM = """You are a Senior Technical Recruiter and resume coach. Given a candidate's parsed resume, a parsed job description, and an ATS evaluation report, produce focused suggestions to align the resume to the JD and raise the ATS score.

You must return suggestions in EXACTLY three buckets and nothing else:
1. summary — a rewritten 2 to 4 sentence professional summary tailored to the JD.
2. skills — skills to ADD to the resume. Only suggest skills the candidate plausibly possesses based on their existing experience or projects. Never suggest a skill the candidate already lists.
3. experience — bullet-level rewrites of EXISTING bullets. You may rephrase, surface JD-relevant tools/verbs, and tighten wording. You MUST reference an existing bullet by experience_index and bullet_index.

Hard rules — violating any rule invalidates the suggestion:
- Do NOT invent employers, job titles, durations, degrees, certifications, or metrics.
- Do NOT add numbers, percentages, or dollar amounts that are not present in the original bullet.
- Do NOT add new experience entries or new bullets — only rewrite existing ones.
- Skill suggestions must be single skills/tools (e.g. "Kubernetes"), not phrases.
- Every suggestion must include a one-line rationale tying it to the JD or the evaluation's weaknesses/missing keywords.

Return ONLY a valid JSON object with this exact shape:
{
  "summary": {
    "suggested": "string (2-4 sentences)",
    "rationale": "string (one line)"
  },
  "skills": [
    { "skill": "string", "rationale": "string (one line)" }
  ],
  "experience": [
    {
      "experience_index": 0,
      "bullet_index": 0,
      "suggested": "string (rewritten bullet)",
      "rationale": "string (one line)"
    }
  ]
}

If a bucket has no good suggestions, return an empty array (or omit summary). No explanation. No markdown. JSON only."""


def _model_name() -> str:
    return (settings.SUGGESTION_LLM_MODEL or settings.OLLAMA_MODEL).strip()


def _existing_bullets(parsed_data: dict) -> list[list[str]]:
    """Return experience[i] -> list of bullet strings, normalized."""
    out: list[list[str]] = []
    for exp in parsed_data.get("experience", []) or []:
        desc = exp.get("description")
        if isinstance(desc, list):
            bullets = [str(b).strip() for b in desc if str(b).strip()]
        elif isinstance(desc, str) and desc.strip():
            bullets = [desc.strip()]
        else:
            bullets = []
        out.append(bullets)
    return out


def _existing_skills_lower(parsed_data: dict) -> set[str]:
    skills = parsed_data.get("skills") or []
    out: set[str] = set()
    for s in skills:
        if isinstance(s, str) and s.strip():
            out.add(s.strip().lower())
    return out


def _build_user_message(
    *,
    parsed_resume: dict,
    parsed_jd: Optional[dict],
    jd_text: Optional[str],
    evaluation: dict,
) -> str:
    payload: dict[str, Any] = {
        "resume": {
            "summary": parsed_resume.get("summary"),
            "skills": parsed_resume.get("skills", []),
            "experience": parsed_resume.get("experience", []),
        },
        "evaluation": {
            "weaknesses": evaluation.get("weaknesses", []),
            "missing_keywords": evaluation.get("missing_keywords", []),
            "experience_fit": evaluation.get("experience_fit", ""),
            "match_report": evaluation.get("match_report", ""),
        },
    }
    if parsed_jd:
        payload["job_description"] = parsed_jd
    elif jd_text:
        payload["job_description_raw"] = jd_text[:10_000]
    return json.dumps(payload, ensure_ascii=False)


def validate_and_normalize(
    raw: dict,
    *,
    parsed_resume: dict,
) -> dict:
    """Drop suggestions that violate constraints; stamp deterministic suggestion_ids.

    - Skills already on the resume (case-insensitive) are dropped.
    - Experience suggestions with out-of-range indices are dropped.
    - Free-text fields are coerced to strings.
    - Empty summary suggestion is dropped.
    """
    existing_skills = _existing_skills_lower(parsed_resume)
    bullets = _existing_bullets(parsed_resume)

    # Summary — single object
    summary_out = None
    summary_in = raw.get("summary")
    if isinstance(summary_in, dict):
        suggested = _coerce_text(summary_in.get("suggested")).strip()
        if suggested:
            summary_out = {
                "suggestion_id": "sum_1",
                "current": _coerce_text(parsed_resume.get("summary")).strip() or None,
                "suggested": suggested,
                "rationale": _coerce_text(summary_in.get("rationale")).strip(),
            }

    # Skills — dedupe against existing + against earlier suggestions in this bundle
    skills_out: list[dict] = []
    seen_lower: set[str] = set()
    for item in raw.get("skills") or []:
        if not isinstance(item, dict):
            continue
        skill = _coerce_text(item.get("skill")).strip()
        if not skill:
            continue
        lower = skill.lower()
        if lower in existing_skills or lower in seen_lower:
            continue
        seen_lower.add(lower)
        skills_out.append({
            "suggestion_id": f"sk_{len(skills_out) + 1}",
            "skill": skill,
            "rationale": _coerce_text(item.get("rationale")).strip(),
        })

    # Experience — index-validated rewrites
    experience_out: list[dict] = []
    for item in raw.get("experience") or []:
        if not isinstance(item, dict):
            continue
        try:
            exp_idx = int(item.get("experience_index"))
            bullet_idx = int(item.get("bullet_index"))
        except (TypeError, ValueError):
            continue
        if exp_idx < 0 or exp_idx >= len(bullets):
            continue
        if bullet_idx < 0 or bullet_idx >= len(bullets[exp_idx]):
            continue
        suggested = _coerce_text(item.get("suggested")).strip()
        if not suggested:
            continue
        current = bullets[exp_idx][bullet_idx]
        if suggested == current:
            continue
        experience_out.append({
            "suggestion_id": f"ex_{len(experience_out) + 1}",
            "experience_index": exp_idx,
            "bullet_index": bullet_idx,
            "current": current,
            "suggested": suggested,
            "rationale": _coerce_text(item.get("rationale")).strip(),
        })

    return {
        "summary": summary_out,
        "skills": skills_out,
        "experience": experience_out,
    }


async def generate_suggestions(
    *,
    parsed_resume: dict,
    parsed_jd: Optional[dict],
    jd_text: Optional[str],
    evaluation: dict,
) -> dict:
    user_message = _build_user_message(
        parsed_resume=parsed_resume,
        parsed_jd=parsed_jd,
        jd_text=jd_text,
        evaluation=evaluation,
    )

    model = _model_name()
    response = await _client.chat(
        model=model,
        format="json",
        # Generous predict budget — bullet rewrites + summary + ~10 skills can run long.
        # Low temperature keeps the rewrite faithful to the source bullets.
        options={
            "num_ctx": 8192,
            "num_predict": 4096,
            "temperature": 0.2,
        },
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_message},
        ],
    )
    raw_text = response.message.content
    logger.info(
        "Suggestion LLM (%s) raw response (%d chars): %s",
        model,
        len(raw_text or ""),
        raw_text,
    )
    try:
        raw = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("Suggestion LLM returned non-JSON. Raw: %.500s", raw_text)
        raw = {}

    raw_summary_present = isinstance(raw.get("summary"), dict)
    raw_skills_count = len(raw.get("skills") or []) if isinstance(raw.get("skills"), list) else 0
    raw_exp_count = len(raw.get("experience") or []) if isinstance(raw.get("experience"), list) else 0
    logger.info(
        "Suggestion LLM parsed counts — summary:%s skills:%d experience:%d",
        raw_summary_present,
        raw_skills_count,
        raw_exp_count,
    )

    suggestions = validate_and_normalize(raw, parsed_resume=parsed_resume)
    logger.info(
        "Suggestion post-validation counts — summary:%s skills:%d experience:%d",
        suggestions["summary"] is not None,
        len(suggestions["skills"]),
        len(suggestions["experience"]),
    )

    return {
        "suggestions": suggestions,
        "model": model,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
