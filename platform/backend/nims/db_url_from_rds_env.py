"""Build DB URLs from PG* env (ECS + Secrets Manager RDS JSON keys).

Prisma migrate needs ``postgresql://...``; SQLAlchemy uses ``postgresql+psycopg://...``.
"""

from __future__ import annotations

import os
import sys
import urllib.parse


def _parts() -> tuple[str, str, str, str, str]:
    user = os.environ["PGUSER"]
    password = os.environ["PGPASSWORD"]
    host = os.environ["PGHOST"]
    port = os.environ.get("PGPORT", "5432")
    db = os.environ.get("PGDATABASE", "nims")
    return user, password, host, port, db


def sqlalchemy_url() -> str:
    user, password, host, port, db = _parts()
    u = urllib.parse.quote(user, safe="")
    p = urllib.parse.quote(password, safe="")
    return f"postgresql+psycopg://{u}:{p}@{host}:{port}/{db}"


def prisma_migrate_url() -> str:
    """Plain libpq URL for ``npx prisma migrate`` (no SQLAlchemy driver suffix)."""
    user, password, host, port, db = _parts()
    u = urllib.parse.quote(user, safe="")
    p = urllib.parse.quote(password, safe="")
    return f"postgresql://{u}:{p}@{host}:{port}/{db}"


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "sqlalchemy"
    if mode == "prisma":
        print(prisma_migrate_url(), end="")
    else:
        print(sqlalchemy_url(), end="")


if __name__ == "__main__":
    main()
