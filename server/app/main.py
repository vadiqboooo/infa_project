"""FastAPI application entry-point."""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.routers import admin, analytics, auth, billing, content, course_leads, exams, group_plan, preparation, solving, stats

logger = logging.getLogger(__name__)

os.makedirs("uploads/exam_solutions", exist_ok=True)
os.makedirs("uploads/task_solutions", exist_ok=True)
os.makedirs("uploads/step_images", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Ensure all tables exist (create_all is idempotent — skips existing tables)
    try:
        from app.database import engine
        from app.models import exam_analysis  # noqa: ensure model is registered
        from app.models import group as group_module  # noqa: ensure models are registered
        from app.models import topic_seen  # noqa: ensure model is registered
        from app.models import course_lead, exam_subject_settings, payment, site_visit  # noqa: ensure models are registered
        from app.models import (
            admin_help_notification_read,
            task_solution,
            task_solution_comment,
            task_solution_comment_read,
            task_solution_comment_reaction,
            task_solution_help_request,
            task_solution_help_message,
            task_solution_version,
        )  # noqa: ensure models are registered
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: exam_analysis.ExamAnalysis.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: group_module.Group.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: group_module.user_groups.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: topic_seen.UserTopicSeen.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: task_solution.UserTaskSolution.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_comment.UserTaskSolutionComment.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_comment_read.UserTaskSolutionCommentRead.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_comment_reaction.UserTaskSolutionCommentReaction.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_help_request.UserTaskSolutionHelpRequest.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_help_message.UserTaskSolutionHelpMessage.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: task_solution_version.UserTaskSolutionVersion.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: admin_help_notification_read.AdminHelpNotificationRead.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.run_sync(
                lambda sync_conn: course_lead.CourseLead.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: payment.Payment.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: site_visit.SiteVisit.__table__.create(sync_conn, checkfirst=True)
            )
            await conn.run_sync(
                lambda sync_conn: exam_subject_settings.ExamSubjectSettings.__table__.create(
                    sync_conn, checkfirst=True
                )
            )
            await conn.execute(text("ALTER TABLE user_task_solutions ADD COLUMN IF NOT EXISTS recognized_text TEXT"))
            await conn.execute(text("ALTER TABLE user_task_solutions ADD COLUMN IF NOT EXISTS board_data JSON"))
            await conn.execute(text("ALTER TABLE user_task_solution_help_requests ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'open'"))
            await conn.execute(text("ALTER TABLE user_task_solution_help_requests ADD COLUMN IF NOT EXISTS closed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))
            await conn.execute(text("ALTER TABLE user_task_solution_help_requests ADD COLUMN IF NOT EXISTS close_reason VARCHAR(64)"))
            await conn.execute(text("ALTER TABLE group_lessons ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_group_lessons_student_id ON group_lessons (student_id)"))
            await conn.execute(text("ALTER TABLE topics ADD COLUMN IF NOT EXISTS exam_type VARCHAR(10) NOT NULL DEFAULT 'ege'"))
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject VARCHAR(50) NOT NULL DEFAULT 'informatics'"))
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS exam_type VARCHAR(10) NOT NULL DEFAULT 'ege'"))
            await conn.execute(text("ALTER TABLE tasks ALTER COLUMN topic_id DROP NOT NULL"))
        logger.info("exam_analyses, groups, user_groups, user_topic_seen, user_task_solutions tables ensured.")
    except Exception as e:
        logger.warning("Table creation failed: %s", e)
    yield


app = FastAPI(
    title="Edu Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — adjust origins for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(billing.router)
app.include_router(course_leads.router)
app.include_router(content.router)
app.include_router(solving.router)
app.include_router(exams.router)
app.include_router(stats.router)
app.include_router(preparation.router)
app.include_router(group_plan.router)
app.include_router(group_plan.admin_router)
app.include_router(admin.router, prefix="/admin")

# Serve uploaded files (exam solutions)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("422 validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok"}
