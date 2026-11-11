#!/usr/bin/env python
"""OWN AI backend - single-command launcher.

    python app.py                 # development: 127.0.0.1:8000 with auto-reload
    python app.py --port 9000     # different port
    python app.py --no-reload     # one process, no file watcher
    python app.py --workers 4     # multi-process (production, needs --no-reload)
    python app.py --check         # validate config + database, then exit

This file only does argument parsing and diagnostics; everything else lives in
``app/main.py`` so ``uvicorn app.main:app`` and ``TestClient`` behave identically.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

BANNER = """
==============================================================
  O W N   A I   -   Multilingual AI Calling Platform
==============================================================
""".strip("\n")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    from app.core.config import settings

    parser = argparse.ArgumentParser(
        prog="app.py",
        description="Run the OWN AI backend.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--host", default=settings.app_host, help="Bind address.")
    parser.add_argument("--port", type=int, default=settings.app_port, help="Bind port.")
    parser.add_argument(
        "--reload",
        dest="reload",
        action="store_true",
        default=settings.app_reload,
        help="Restart on file changes (development only).",
    )
    parser.add_argument(
        "--no-reload", dest="reload", action="store_false", help="Disable the file watcher."
    )
    parser.add_argument(
        "--workers", type=int, default=1, help="Worker processes (disables reload)."
    )
    parser.add_argument(
        "--log-level", default=settings.log_level.lower(), help="uvicorn log level."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify configuration and database connectivity, then exit.",
    )
    return parser.parse_args(argv)


def run_checks() -> int:
    """Pre-flight diagnostics - the same information printed at startup."""
    from app.core.config import settings
    from app.database.init_db import init_database
    from app.database.session import check_database
    from app.integrations import registry

    print(BANNER)
    print(f"  {settings.app_name} {settings.app_version}  ({settings.app_env})")
    print(f"  Python  {sys.version.split()[0]}")
    print(f"  Root    {BACKEND_DIR}")
    print()

    print("[1/3] Configuration")
    for key, value in settings.masked().items():
        print(f"      {key:<32} {value}")
    print()

    print("[2/3] Database")
    try:
        init_database()
        ok = check_database()
        print(f"      {settings.database_url}")
        print(f"      connectivity: {'OK' if ok else 'FAILED'}")
    except Exception as exc:
        print(f"      FAILED: {exc}")
        return 1
    print()

    print("[3/3] Integrations")
    summary = registry.summary()
    for item in summary.get("detail", []):
        state = "ready" if item.get("configured") else "simulated"
        print(f"      {item.get('provider', '?'):<16} {state}")
    print()
    print(f"  Ready: {summary.get('ready')}  Simulated: {summary.get('simulated')}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    # Make the package importable before uvicorn re-imports it in a subprocess.
    os.chdir(BACKEND_DIR)

    if args.check:
        return run_checks()

    import uvicorn

    from app.core.config import settings

    if args.workers > 1 and args.reload:
        print("  --workers > 1 is incompatible with --reload; disabling reload.")
        args.reload = False

    print(BANNER)
    print(f"  {settings.app_name} {settings.app_version}  |  env={settings.app_env}")
    print(f"  API      http://{args.host}:{args.port}{settings.api_v1_prefix}")
    print(f"  Docs     http://{args.host}:{args.port}/docs" if settings.docs_url else "  Docs     disabled")
    print(f"  Health   http://{args.host}:{args.port}/health")
    print()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else None,
        log_level=args.log_level,
        access_log=False,  # the RequestContext middleware logs requests instead
        reload_dirs=[str(BACKEND_DIR / "app")] if args.reload else None,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
