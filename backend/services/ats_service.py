import asyncio
import logging
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

from db.repositories.ats_repo import insert_evaluation
from db.repositories.parsed_resume_repo import get_parsed_by_resume_id
from services.llm_service import evaluate_ats_match

logger = logging.getLogger(__name__)

_MODEL_NAME = "BAAI/bge-m3"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    logger.info("Loading %s embedding model (first use)…", _MODEL_NAME)
    return SentenceTransformer(_MODEL_NAME)


def _resume_to_text(data: dict) -> str:
    parts = []
    if s := data.get("summary"):
        parts.append(s)
    if skills := data.get("skills"):
        skill_strs = [s if isinstance(s, str) else str(s) for s in skills]
        parts.append("Skills: " + ", ".join(skill_strs))
    for exp in data.get("experience", []):
        parts.append(
            f"{exp.get('title', '')} at {exp.get('company', '')} — {exp.get('description', '')}"
        )
    for proj in data.get("projects", []):
        parts.append(f"Project {proj.get('name', '')}: {proj.get('description', '')}")
    if certs := data.get("certifications"):
        cert_strs = [
            c if isinstance(c, str) else c.get("name") or c.get("title") or str(c)
            for c in certs
        ]
        parts.append("Certifications: " + ", ".join(cert_strs))
    return " ".join(parts) or str(data)


def _jd_to_text(data: dict) -> str:
    parts = []
    if t := data.get("job_title"):
        parts.append(t)
    if req := data.get("required_skills"):
        parts.append("Required: " + ", ".join(req))
    if pref := data.get("preferred_skills"):
        parts.append("Preferred: " + ", ".join(pref))
    parts.extend(data.get("responsibilities", []))
    if kw := data.get("keywords"):
        parts.append("Keywords: " + ", ".join(kw))
    return " ".join(parts) or str(data)


async def _encode(texts: list[str]) -> np.ndarray:
    loop = asyncio.get_event_loop()
    model = _get_model()
    return await loop.run_in_executor(
        None,
        lambda: model.encode(texts, normalize_embeddings=True, show_progress_bar=False),
    )


def _coerce_text(value) -> str:
    """LLM occasionally returns a dict/list for fields the prompt asks for as a string
    (e.g. formatting_feedback bucketed by check name). Flatten to a readable string so
    TEXT columns accept it."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return "\n".join(f"{k}: {_coerce_text(v)}" for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return "\n".join(_coerce_text(item) for item in value)
    return str(value)


async def compute_ats_score(
    db,
    *,
    resume_id,
    parsed_jd: dict,
    jd_text: str | None = None,
    jd_title: str | None = None,
) -> dict:
    parsed = await get_parsed_by_resume_id(db, resume_id)
    if parsed is None:
        raise ValueError(f"No parsed resume found for resume_id={resume_id}")

    resume_data = parsed.parsed_data or {}

    # Part A: BGE-M3 vector similarity
    embeddings = await _encode([_resume_to_text(resume_data), _jd_to_text(parsed_jd)])
    v_a, v_b = embeddings[0], embeddings[1]
    semantic_score = float(
        np.dot(v_a, v_b) / (np.linalg.norm(v_a) * np.linalg.norm(v_b) + 1e-9)
    )
    logger.info("Semantic similarity score: %.4f", semantic_score)

    # Part B: LLM qualitative evaluation
    evaluation = await evaluate_ats_match(
        resume_data=resume_data,
        jd_data=parsed_jd,
        semantic_score=semantic_score,
    )

    # Normalize free-text fields — LLM may return dict/list for prompt-string fields.
    experience_fit = _coerce_text(evaluation.get("experience_fit", ""))
    formatting_feedback = _coerce_text(evaluation.get("formatting_feedback", ""))
    match_report = _coerce_text(evaluation.get("match_report", ""))

    record = await insert_evaluation(
        db,
        resume_id=resume_id,
        ats_score=evaluation.get("ats_score", round(semantic_score * 100)),
        match_percentage=evaluation.get("match_percentage", round(semantic_score * 100)),
        matching_skills=evaluation.get("matching_skills", []),
        experience_fit=experience_fit,
        strengths=evaluation.get("strengths", []),
        weaknesses=evaluation.get("weaknesses", []),
        missing_keywords=evaluation.get("missing_keywords", []),
        formatting_feedback=formatting_feedback,
        match_report=match_report,
        jd_text=jd_text,
        jd_title=jd_title,
    )

    # Reflect normalized values in the response so the dashboard renders a string.
    evaluation["experience_fit"] = experience_fit
    evaluation["formatting_feedback"] = formatting_feedback
    evaluation["match_report"] = match_report
    evaluation["evaluation_id"] = str(record.id)
    return evaluation
