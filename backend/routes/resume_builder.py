import uuid
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from services import resume_builder_service

router = APIRouter()


class BasicsModel(BaseModel):
    name: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    github: str = ""
    linkedin: str = ""


class EducationItem(BaseModel):
    institution: str = ""
    location: str = ""
    degree: str = ""
    gpa: str = ""
    years: str = ""
    coursework: str = ""
    activities: str = ""


class ExperienceItem(BaseModel):
    company: str = ""
    location: str = ""
    title: str = ""
    duration: str = ""
    bullets: list[str] = []


class SkillLevel(BaseModel):
    emoji: str = ""
    level: str = ""
    items: str = ""


class Award(BaseModel):
    name: str = ""
    date: str = ""


class ResumeGenerateRequest(BaseModel):
    basics: BasicsModel = BasicsModel()
    education: list[EducationItem] = []
    experience: list[ExperienceItem] = []
    skills: list[SkillLevel] = []
    awards: list[Award] = []


@router.post("/resume-builder/generate")
async def generate_resume(
    body: ResumeGenerateRequest,
    x_user_id: Optional[str] = Header(default=None),
):
    user_id = x_user_id or f"guest_{uuid.uuid4().hex[:6]}"
    pdf_url = await resume_builder_service.generate_pdf(body.model_dump(), user_id)
    return {"pdf_url": pdf_url}
