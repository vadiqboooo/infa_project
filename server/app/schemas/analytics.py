"""Schemas for site analytics."""

from pydantic import BaseModel, Field


class SiteVisitIn(BaseModel):
    visitor_id: str = Field(min_length=8, max_length=80)
    session_id: str = Field(min_length=8, max_length=80)
    path: str = Field(default="/", max_length=512)
    referrer: str | None = None


class AnalyticsDailyPoint(BaseModel):
    date: str
    visits: int
    visitors: int
    registrations: int


class AnalyticsSummary(BaseModel):
    total_visits: int
    unique_visitors: int
    today_visits: int
    today_unique_visitors: int
    registered_users: int
    today_registrations: int
    conversion_rate: float
    daily: list[AnalyticsDailyPoint]
