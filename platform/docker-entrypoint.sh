#!/bin/bash
set -euo pipefail
cd /app
export NIMS_RELOAD="${NIMS_RELOAD:-false}"

if [[ -n "${PGHOST:-}" ]]; then
  export DATABASE_URL="$(/app/backend/.venv/bin/python -m nims.db_url_from_rds_env sqlalchemy)"
  export PRISMA_MIGRATE_URL="$(/app/backend/.venv/bin/python -m nims.db_url_from_rds_env prisma)"
fi

export PATH="/app/node_modules/.bin:${PATH}"
if [[ -n "${PRISMA_MIGRATE_URL:-}" ]]; then
  DATABASE_URL="${PRISMA_MIGRATE_URL}" npx prisma migrate deploy
else
  npx prisma migrate deploy
fi

if [[ -n "${PGHOST:-}" ]]; then
  export DATABASE_URL="$(/app/backend/.venv/bin/python -m nims.db_url_from_rds_env sqlalchemy)"
fi

unset PRISMA_MIGRATE_URL

exec "$@"
