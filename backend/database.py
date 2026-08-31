"""Database configuration for Kirana Smart Assistant.
SQLAlchemy setup with PostgreSQL (Supabase compatible) and SQLite fallback.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./kirana.db"
)

# SQLite needs special connect args; PostgreSQL does not
connect_args = {}
engine_kwargs = {
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # Supabase / pooler connections use SSL
    engine_kwargs["connect_args"] = {"sslmode": "require"}
    # Render's built-in Postgres also uses SSL
    if ":5432" in DATABASE_URL and "supabase" not in DATABASE_URL:
        engine_kwargs["connect_args"] = {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
