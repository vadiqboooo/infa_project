"""Public course lead collection routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.course_lead import CourseLead
from app.schemas.course_lead import CourseLeadIn, CourseLeadOut

router = APIRouter(prefix="/course-leads", tags=["course-leads"])

ALLOWED_SUBJECTS = {"math", "physics", "russian", "english", "social", "history", "chemistry", "biology"}


@router.post("", response_model=CourseLeadOut, status_code=status.HTTP_201_CREATED)
async def create_course_lead(body: CourseLeadIn, db: AsyncSession = Depends(get_db)):
    subject = body.subject.strip().lower()
    contact = body.contact.strip()
    if subject not in ALLOWED_SUBJECTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестный предмет")
    if len(contact) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите email или Telegram")

    db.add(CourseLead(subject=subject, contact=contact, note=body.note))
    await db.commit()

    if subject == "math":
        message = "Заявка принята. Мы отправим уведомление, когда курс по математике стартует."
    else:
        message = "Заявка принята. Как только наберется нужное количество учеников, этот предмет появится."
    return CourseLeadOut(message=message)
