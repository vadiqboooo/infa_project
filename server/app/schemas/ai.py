"""Schemas for AI assistant requests / responses."""

from pydantic import BaseModel

from app.models.ai_chat_log import AIMode


class AIAssistRequest(BaseModel):
    user_query: str
    mode: AIMode = AIMode.tutorial
    user_code: str | None = None


class AIAssistResponse(BaseModel):
    hint: str
