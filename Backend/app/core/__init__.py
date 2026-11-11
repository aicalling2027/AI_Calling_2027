"""Core cross-cutting concerns: configuration, security, logging, errors."""

from app.core.config import settings
from app.core.exceptions import AppError

__all__ = ["settings", "AppError"]
