"""Schemas for landing page course leads."""

from pydantic import BaseModel


class CourseLeadIn(BaseModel):
    subject: str
    contact: str
    note: str | None = None


class CourseLeadOut(BaseModel):
    ok: bool = True
    message: str
