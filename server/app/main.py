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
    # Auto-apply pending Alembic migrations on startup
    try:
        import subprocess
        result = subprocess.run(
            ["python", "-m", "alembic", "upgrade", "head"],
            capture_output=True, text=True, check=True
        )
        logger.info("Alembic migrations applied. %s", result.stdout.strip())
    except Exception as e:
        logger.warning("Alembic migration failed: %s", e)
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
