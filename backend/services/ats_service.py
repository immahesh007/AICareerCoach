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
    # ~2.3 GB download on first call; cached to ~/.cache/huggingface/ thereafter.
    logger.info("Loading BGE-M3 embedding model (first use — may take a moment)…")
    return SentenceTransformer(_MODEL_NAME)


def _resume_to_text(data: dict) -> str:
    parts = []
    if s := data.get("summary"):
        parts.append(s)
    if skills := data.get("skills"):
        parts.append("Skills: " + ", ".join(skills))
    for exp in data.get("experience", []):
        parts.append(
            f"{exp.get('title', '')} at {exp.get('company', '')} — {exp.get('description', '')}"
        )
    for proj in data.get("projects", []):
        parts.append(f"Project {proj.get('name', '')}: {proj.get('description', '')}")
    if certs := data.get("certifications"):
        parts.append("Certifications: " + ", ".join(certs))
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


async def compute_ats_score(db, *, resume_id, parsed_jd: dict) -> dict:
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

    # Persist to ats_evaluations
    await insert_evaluation(
        db,
        resume_id=resume_id,
        ats_score=evaluation.get("ats_score", round(semantic_score * 100)),
        strengths=evaluation.get("strengths", []),
        weaknesses=evaluation.get("weaknesses", []),
        missing_keywords=evaluation.get("missing_keywords", []),
        formatting_feedback=evaluation.get("formatting_feedback", ""),
        match_report=evaluation.get("match_report", ""),
    )

    return evaluation
