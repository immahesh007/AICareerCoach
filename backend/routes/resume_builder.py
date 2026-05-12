import uuid
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from services import resume_builder_service

router = APIRouter()


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
