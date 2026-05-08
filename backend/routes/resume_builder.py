import uuid
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from services import resume_builder_service

router = APIRouter()


class BasicsModel(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    summary: str = ""


class ExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""
    description: str = ""


class EducationItem(BaseModel):
    year: str = ""
    degree: str = ""
    institution: str = ""


class ResumeGenerateRequest(BaseModel):
    basics: BasicsModel
    skills: list[str] = []
    experience: list[ExperienceItem] = []
    education: list[EducationItem] = []
    certifications: list[str] = []


@router.post("/resume-builder/generate")
async def generate_resume(
    body: ResumeGenerateRequest,
    x_user_id: Optional[str] = Header(default=None),
):
    user_id = x_user_id or f"guest_{uuid.uuid4().hex[:6]}"
    pdf_url = await resume_builder_service.generate_pdf(body.model_dump(), user_id)
    return {"pdf_url": pdf_url}
