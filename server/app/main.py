"""FastAPI application entry-point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, content, exams, solving


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    yield  # nothing special on startup for now


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
app.include_router(admin.router, prefix="/admin")


@app.get("/", tags=["health"])
async def health_check():
    return {"status": "ok"}
