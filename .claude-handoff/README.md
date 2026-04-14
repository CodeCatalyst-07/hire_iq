# HireIQ — Backend Implementation Handoff

Welcome, Claude Code. This folder contains everything you need to build the **HireIQ** backend from scratch.

## Folder Structure

Read these files **in order**:

| File | Description |
|------|-------------|
| `01-system-architecture.md` | High-level design, tech stack, and service boundaries |
| `02-database-schema.md` | Full PostgreSQL schema with table definitions and indexes |
| `03-api-contracts.md` | All REST API endpoints the frontend expects to consume |
| `04-ai-integrations.md` | LLM integration for resume parsing, scoring, and question generation |

## Project Layout to Create

```
backend/
├── app/
│   ├── main.py              # FastAPI app entrypoint
│   ├── config.py            # Settings via Pydantic BaseSettings
│   ├── database.py          # SQLAlchemy engine + session factory
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── routers/             # FastAPI APIRouter per domain
│   ├── services/            # Business logic (parser, scorer, interviewer)
│   └── utils/               # Helpers (file handling, LLM client, etc.)
├── alembic/                 # Database migrations
├── requirements.txt
├── .env.example
└── README.md
```

## Bootstrap Commands

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Instruction Priority

If anything seems ambiguous, **prefer the API contract** (file 03) over the architecture overview, since those endpoints are what the frontend is already structured to call.
