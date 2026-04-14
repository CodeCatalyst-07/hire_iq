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
from app.routers import auth, jobs, candidates, questions, sessions, dashboard  # noqa: E402

api.include_router(auth.router)
api.include_router(jobs.router)
api.include_router(candidates.router)
api.include_router(questions.router)
api.include_router(sessions.router)
api.include_router(dashboard.router)


@api.get("/api/health")
def health():
    return {"status": "ok", "service": "HireIQ API"}


@api.on_event("startup")
def create_tables():
    """Auto-create all database tables on startup."""
    Base.metadata.create_all(bind=engine)


# Expose as 'app' so uvicorn can find it via app.main:app
app = api
