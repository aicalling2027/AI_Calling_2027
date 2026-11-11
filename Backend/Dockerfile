# OWN AI backend image.
#
#   docker build -t ownai-backend .
#   docker run -p 8000:8000 --env-file .env ownai-backend
#
# The default command runs the same entry point as local development, so what
# you test on your machine is exactly what ships.

FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv/app

# Build dependencies for wheels that have no manylinux build (psycopg, etc.).
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-postgres.txt ./
RUN pip install -r requirements.txt \
 && pip install -r requirements-postgres.txt

COPY . .

# Run as a non-root user; the SQLite fallback lives under /srv/app/data.
RUN useradd --create-home --uid 10001 ownai \
 && mkdir -p /srv/app/data \
 && chown -R ownai:ownai /srv/app
USER ownai

ENV APP_ENV=production \
    APP_HOST=0.0.0.0 \
    APP_PORT=8000 \
    APP_RELOAD=false \
    LOG_JSON=true \
    DATABASE_URL=sqlite:////srv/app/data/aotms.db

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["python", "app.py", "--no-reload", "--workers", "1"]
