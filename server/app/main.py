"""FastAPI application entry-point."""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import admin, auth, content, exams, solving, stats

logger = logging.getLogger(__name__)

os.makedirs("uploads/exam_solutions", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    # Ensure all tables exist (create_all is idempotent — skips existing tables)
    try:
        from app.database import engine
        from app.models import exam_analysis  # noqa: ensure model is registered
        from sqlalchemy import inspect as sa_inspect
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: exam_analysis.ExamAnalysis.__table__.create(sync_conn, checkfirst=True)
            )
        logger.info("exam_analyses table ensured.")
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
app.include_router(content.router)
app.include_router(solving.router)
app.include_router(exams.router)
app.include_router(stats.router)
app.include_router(admin.router, prefix="/admin")

# Serve uploaded files (exam solutions)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok"}
