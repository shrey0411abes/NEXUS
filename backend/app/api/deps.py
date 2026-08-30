"""Dependency injection helpers for FastAPI backend."""
from typing import Generator
from sqlalchemy.orm import Session
from database import get_db

# Re-export get_db for clean dependency injection
__all__ = ["get_db", "Session"]
