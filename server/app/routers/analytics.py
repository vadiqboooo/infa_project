"""Site analytics tracking and admin reporting."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, verify_parser_api_key
from app.models.site_visit import SiteVisit
from app.models.user import User
from app.schemas.analytics import AnalyticsDailyPoint, AnalyticsSummary, SiteVisitIn

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    return request.client.host[:64] if request.client else None


async def _optional_user_id(authorization: str | None, db: AsyncSession) -> int | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        return None

    result = await db.execute(select(User.id).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(
    body: SiteVisitIn,
    request: Request,
    authorization: str | None = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _optional_user_id(authorization, db)
    db.add(
        SiteVisit(
            visitor_id=body.visitor_id,
            session_id=body.session_id,
            user_id=user_id,
            path=body.path,
            referrer=body.referrer[:2048] if body.referrer else None,
            user_agent=request.headers.get("user-agent"),
            ip_address=_client_ip(request),
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin/summary", response_model=AnalyticsSummary, dependencies=[Depends(verify_parser_api_key)])
async def analytics_summary(days: int = 14, db: AsyncSession = Depends(get_db)):
    days = max(1, min(days, 90))
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=days - 1)

    total_visits = await db.scalar(select(func.count(SiteVisit.id))) or 0
    unique_visitors = await db.scalar(select(func.count(distinct(SiteVisit.visitor_id)))) or 0
    today_visits = await db.scalar(select(func.count(SiteVisit.id)).where(SiteVisit.created_at >= today)) or 0
    today_unique_visitors = await db.scalar(
        select(func.count(distinct(SiteVisit.visitor_id))).where(SiteVisit.created_at >= today)
    ) or 0
    registered_users = await db.scalar(select(func.count(User.id)).where(User.role != "admin")) or 0
    today_registrations = await db.scalar(
        select(func.count(User.id)).where(User.role != "admin", User.created_at >= today)
    ) or 0

    visits_rows = await db.execute(
        select(
            func.date(SiteVisit.created_at).label("day"),
            func.count(SiteVisit.id).label("visits"),
            func.count(distinct(SiteVisit.visitor_id)).label("visitors"),
        )
        .where(SiteVisit.created_at >= start)
        .group_by(func.date(SiteVisit.created_at))
    )
    registrations_rows = await db.execute(
        select(
            func.date(User.created_at).label("day"),
            func.count(User.id).label("registrations"),
        )
        .where(User.role != "admin", User.created_at >= start)
        .group_by(func.date(User.created_at))
    )

    visits_by_day = {
        str(day): {"visits": int(visits), "visitors": int(visitors)}
        for day, visits, visitors in visits_rows.all()
    }
    registrations_by_day = {str(day): int(count) for day, count in registrations_rows.all()}
    daily: list[AnalyticsDailyPoint] = []
    for index in range(days):
        day = (start + timedelta(days=index)).date().isoformat()
        visit_data = visits_by_day.get(day, {"visits": 0, "visitors": 0})
        daily.append(
            AnalyticsDailyPoint(
                date=day,
                visits=visit_data["visits"],
                visitors=visit_data["visitors"],
                registrations=registrations_by_day.get(day, 0),
            )
        )

    conversion_rate = round((registered_users / unique_visitors) * 100, 1) if unique_visitors else 0.0
    return AnalyticsSummary(
        total_visits=total_visits,
        unique_visitors=unique_visitors,
        today_visits=today_visits,
        today_unique_visitors=today_unique_visitors,
        registered_users=registered_users,
        today_registrations=today_registrations,
        conversion_rate=conversion_rate,
        daily=daily,
    )
