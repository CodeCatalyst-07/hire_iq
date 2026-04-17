from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create FastAPI app FIRST, before any other imports that depend on it
api = FastAPI(
    title="HireIQ API",
    description="AI-Powered Recruitment Platform Backend",
    version="1.0.0",
)

# CORS middleware must be registered before routers
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Open for local dev — restrict in production
    allow_credentials=False,   # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Import after app creation (avoids naming collision with 'app' package)
from app.database import engine, Base       # noqa: E402
import app.models                           # noqa: E402, F401
from app.routers import auth, jobs, candidates, questions, sessions, dashboard, transcribe  # noqa: E402

api.include_router(auth.router)
api.include_router(jobs.router)
api.include_router(candidates.router)
api.include_router(questions.router)
api.include_router(sessions.router)
api.include_router(dashboard.router)
api.include_router(transcribe.router)


@api.get("/api/health")
def health():
    return {"status": "ok", "service": "HireIQ API"}


@api.on_event("startup")
def create_tables():
    """Auto-create all database tables on startup."""
    import logging
    from app.config import settings
    startup_logger = logging.getLogger("hireiq.startup")
    logging.basicConfig(level=logging.INFO)

    startup_logger.info("=" * 60)
    startup_logger.info("HireIQ API — Startup Diagnostics")
    startup_logger.info(f"  GEMINI_MODEL     : {settings.gemini_model}")
    startup_logger.info(f"  GEMINI_API_KEY   : {'SET (' + settings.gemini_api_key[:8] + '...)' if settings.gemini_api_key else 'MISSING ⚠️'}")
    startup_logger.info(f"  DATABASE_URL     : {'SET' if settings.database_url else 'MISSING ⚠️'}")
    startup_logger.info(f"  JWT_SECRET_KEY   : {'SET' if settings.jwt_secret_key else 'MISSING ⚠️'}")
    startup_logger.info(f"  FRONTEND_URL     : {settings.frontend_url}")
    startup_logger.info("=" * 60)

    Base.metadata.create_all(bind=engine)


# Expose as 'app' so uvicorn can find it via app.main:app
app = api
