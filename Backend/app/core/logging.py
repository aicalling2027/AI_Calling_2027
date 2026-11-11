"""Structured application logging."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings

_CONFIGURED = False

_RESERVED = frozenset(
    {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "module", "msecs",
        "message", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName", "taskName",
    }
)


class JsonFormatter(logging.Formatter):
    """Minimal structured formatter for log aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        return json.dumps(payload, default=str, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    """Human readable formatter for local development."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        )


def configure_logging() -> None:
    """Install the root logging handler exactly once."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if settings.log_json else TextFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(settings.log_level.upper())

    # Quiet noisy third-party loggers.
    for noisy in ("uvicorn.access", "sqlalchemy.engine.Engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(max(logging.WARNING, root.level))

    _CONFIGURED = True


#: Keyword arguments that ``logging`` itself understands and must not be
#: treated as structured fields.
_LOG_KWARGS = frozenset({"exc_info", "stack_info", "stacklevel"})


class StructuredLogger(logging.LoggerAdapter):
    """Logger adapter that accepts arbitrary structured fields as kwargs.

    ``structlog``-style calls such as::

        logger.info("call_failed", call_id=call.id, provider="sarvam")

    are not valid for the stdlib logger, which only accepts positional
    formatting plus ``exc_info``/``extra``. Rather than force every module to
    wrap its fields in ``extra={...}``, this adapter moves unknown keyword
    arguments into ``extra`` so the JSON formatter can emit them as structured
    attributes and the text formatter can ignore them.
    """

    def process(self, msg: Any, kwargs: dict[str, Any]) -> tuple[Any, dict[str, Any]]:
        merged: dict[str, Any] = dict(self.extra or {})
        merged.update(kwargs.pop("extra", None) or {})

        for key in [k for k in kwargs if k not in _LOG_KWARGS]:
            merged[key] = kwargs.pop(key)

        # Never let a field collide with a reserved LogRecord attribute.
        clean = {k: v for k, v in merged.items() if k not in _RESERVED}
        if clean:
            kwargs["extra"] = clean
        return msg, kwargs


def get_logger(name: str) -> StructuredLogger:
    configure_logging()
    return StructuredLogger(logging.getLogger(name), {})


def bind_context(logger: logging.Logger | logging.LoggerAdapter, **context: Any) -> StructuredLogger:
    """Return a logger that stamps ``context`` on every record."""
    base = logger.logger if isinstance(logger, logging.LoggerAdapter) else logger
    inherited = dict(logger.extra or {}) if isinstance(logger, logging.LoggerAdapter) else {}
    inherited.update(context)
    return StructuredLogger(base, inherited)
