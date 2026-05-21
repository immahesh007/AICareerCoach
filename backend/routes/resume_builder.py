import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from services import resume_builder_service
from services.llm_service import suggest_resume_improvements

logger = logging.getLogger(__name__)

router = APIRouter()

# Known skill categories (must match frontend DEFAULT_SKILLS)
SKILL_CATEGORIES = {
    "Languages",
    "Frameworks & Technologies",
    "Cloud & DevOps",
    "Tools & Platforms",
    "Software Engineering Concepts",
}


class BasicsModel(BaseModel):
    name: str = ""
    portfolio: str = ""
    github: str = ""
    linkedin: str = ""
    email: str = ""
    phone: str = ""


class EducationItem(BaseModel):
    institution: str = ""
    location: str = ""
    degree: str = ""
    gpa: str = ""
    years: str = ""
    coursework: str = ""


class ExperienceItem(BaseModel):
    company: str = ""
    location: str = ""
    title: str = ""
    duration: str = ""
    bullets: list[str] = []


class SkillCategoryItem(BaseModel):
    category: str = ""
    items: str = ""


class ProjectItem(BaseModel):
    name: str = ""
    tags: str = ""
    description: str = ""
    tech: str = ""
    date: str = ""


class PublicationItem(BaseModel):
    prefix: str = ""
    title: str = ""
    tags: str = ""
    description: str = ""
    tech: str = ""
    date: str = ""


class Award(BaseModel):
    name: str = ""
    date: str = ""


class VolunteerItem(BaseModel):
    org: str = ""
    location: str = ""
    description: str = ""
    duration: str = ""


class ResumeGenerateRequest(BaseModel):
    model_config = {"extra": "allow"}

    basics: BasicsModel = BasicsModel()
    summary: str = ""
    education: list[EducationItem] = []
    skillCategories: list[SkillCategoryItem] = []
    experience: list[ExperienceItem] = []
    projects: list[ProjectItem] = []
    publications: list[PublicationItem] = []
    awards: list[Award] = []
    volunteer: list[VolunteerItem] = []


@router.post("/resume-builder/generate")
async def generate_resume(
    body: ResumeGenerateRequest,
    x_user_id: Optional[str] = Header(default=None),
):
    user_id = x_user_id or f"guest_{uuid.uuid4().hex[:6]}"
    pdf_url = await resume_builder_service.generate_pdf(body.model_dump(), user_id)
    return {"pdf_url": pdf_url}


# ── suggestions ────────────────────────────────────────────────────────────

def _validate_suggestions(raw: dict, data: dict) -> dict:
    """Best-effort validation: keep valid sections, discard invalid ones."""
    result: dict = {}

    # ── summary ──────────────────────────────────────────────────────────
    summary = raw.get("summary")
    if isinstance(summary, dict) and isinstance(summary.get("original"), str) and isinstance(summary.get("suggested"), str):
        if summary["original"].strip() and summary["suggested"].strip() and summary["original"] != summary["suggested"]:
            result["summary"] = summary
        else:
            logger.info("Skipping summary suggestion: empty or unchanged")

    # ── experience ───────────────────────────────────────────────────────
    experience_data = data.get("experience", [])
    raw_exp = raw.get("experience")
    if isinstance(raw_exp, list):
        valid_exp: list[dict] = []
        for exp_sugg in raw_exp:
            if not isinstance(exp_sugg, dict):
                continue
            exp_idx = exp_sugg.get("exp_index")
            if not isinstance(exp_idx, int) or exp_idx < 0 or exp_idx >= len(experience_data):
                continue
            raw_bullets = exp_sugg.get("bullets")
            if not isinstance(raw_bullets, list):
                continue
            actual_bullets = experience_data[exp_idx].get("bullets", [])
            valid_bullets: list[dict] = []
            for b in raw_bullets:
                if not isinstance(b, dict):
                    continue
                bi = b.get("bullet_index")
                if not isinstance(bi, int) or bi < 0 or bi >= len(actual_bullets):
                    continue
                orig = b.get("original", "")
                sugg = b.get("suggested", "")
                if isinstance(orig, str) and isinstance(sugg, str) and orig.strip() and sugg.strip() and orig != sugg:
                    valid_bullets.append({"bullet_index": bi, "original": orig, "suggested": sugg})
            if valid_bullets:
                valid_exp.append({"exp_index": exp_idx, "bullets": valid_bullets})
        if valid_exp:
            result["experience"] = valid_exp

    # ── projects ─────────────────────────────────────────────────────────
    projects_data = data.get("projects", [])
    raw_proj = raw.get("projects")
    if isinstance(raw_proj, list):
        valid_proj: list[dict] = []
        for proj_sugg in raw_proj:
            if not isinstance(proj_sugg, dict):
                continue
            pi = proj_sugg.get("proj_index")
            if not isinstance(pi, int) or pi < 0 or pi >= len(projects_data):
                continue
            proj_entry: dict = {"proj_index": pi}
            for field in ("description", "tech"):
                fv = proj_sugg.get(field)
                if isinstance(fv, dict) and isinstance(fv.get("original"), str) and isinstance(fv.get("suggested"), str):
                    if fv["original"].strip() and fv["suggested"].strip() and fv["original"] != fv["suggested"]:
                        proj_entry[field] = fv
            if len(proj_entry) > 1:
                valid_proj.append(proj_entry)
        if valid_proj:
            result["projects"] = valid_proj

    # ── awards ───────────────────────────────────────────────────────────
    awards_data = data.get("awards", [])
    raw_awards = raw.get("awards")
    if isinstance(raw_awards, list):
        valid_awards: list[dict] = []
        for award_sugg in raw_awards:
            if not isinstance(award_sugg, dict):
                continue
            ai = award_sugg.get("award_index")
            if not isinstance(ai, int) or ai < 0 or ai >= len(awards_data):
                continue
            award_entry: dict = {"award_index": ai}
            for field in ("name", "date"):
                fv = award_sugg.get(field)
                if isinstance(fv, dict) and isinstance(fv.get("original"), str) and isinstance(fv.get("suggested"), str):
                    if fv["original"].strip() and fv["suggested"].strip() and fv["original"] != fv["suggested"]:
                        award_entry[field] = fv
            if len(award_entry) > 1:
                valid_awards.append(award_entry)
        if valid_awards:
            result["awards"] = valid_awards

    # ── volunteer ────────────────────────────────────────────────────────
    volunteer_data = data.get("volunteer", [])
    raw_vol = raw.get("volunteer")
    if isinstance(raw_vol, list):
        valid_vol: list[dict] = []
        for vol_sugg in raw_vol:
            if not isinstance(vol_sugg, dict):
                continue
            vi = vol_sugg.get("vol_index")
            if not isinstance(vi, int) or vi < 0 or vi >= len(volunteer_data):
                continue
            desc = vol_sugg.get("description")
            if isinstance(desc, dict) and isinstance(desc.get("original"), str) and isinstance(desc.get("suggested"), str):
                if desc["original"].strip() and desc["suggested"].strip() and desc["original"] != desc["suggested"]:
                    valid_vol.append({"vol_index": vi, "description": desc})
        if valid_vol:
            result["volunteer"] = valid_vol

    # ── skills reclassifications ─────────────────────────────────────────
    raw_skills = raw.get("skills")
    if isinstance(raw_skills, dict):
        reclass = raw_skills.get("reclassifications")
        if isinstance(reclass, list):
            valid_reclass: list[dict] = []
            for r in reclass:
                if not isinstance(r, dict):
                    continue
                skill = r.get("skill")
                from_cat = r.get("from_category")
                to_cat = r.get("to_category")
                if (
                    isinstance(skill, str) and skill.strip()
                    and isinstance(from_cat, str)
                    and isinstance(to_cat, str)
                    and from_cat in SKILL_CATEGORIES
                    and to_cat in SKILL_CATEGORIES
                    and from_cat != to_cat
                ):
                    valid_reclass.append({"skill": skill.strip(), "from_category": from_cat, "to_category": to_cat})
            if valid_reclass:
                result["skills"] = {"reclassifications": valid_reclass}

    return result


class SuggestionResponse(BaseModel):
    suggestions: dict


@router.post("/resume-builder/suggestions", response_model=SuggestionResponse)
async def get_resume_suggestions(
    body: ResumeGenerateRequest,
    x_user_id: Optional[str] = Header(default=None),
):
    """Generate AI improvement suggestions for a resume.

    Accepts the full resume data and returns per-section suggestions for
    summary, experience bullets, projects, awards, volunteer, and skill
    reclassifications. Guest-allowed.
    """
    data = body.model_dump()
    raw = await suggest_resume_improvements(data)
    validated = _validate_suggestions(raw, data)
    logger.info("Suggestions: %d raw keys, %d validated sections", len(raw), len(validated))
    return {"suggestions": validated}
