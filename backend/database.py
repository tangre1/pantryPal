# backend/database.py
from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///./pantrypal.db"

engine = create_engine(DATABASE_URL, echo=False)


def create_db_and_tables():
    """Create database tables if they don't exist."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that provides a SQLModel Session."""
    with Session(engine) as session:
        yield session
