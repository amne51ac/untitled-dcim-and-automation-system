# syntax=docker/dockerfile:1
# Production image: FastAPI + Prisma migrate + built React UI. Target: ECS Fargate (linux/amd64).

FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/
RUN npm ci && npm ci --prefix web
COPY prisma ./prisma
COPY web ./web
RUN npx prisma generate && npm run web:build

FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl ca-certificates openssl nodejs npm \
  && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY --from=assets /app/node_modules /app/node_modules

COPY backend/pyproject.toml backend/uv.lock ./backend/
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

COPY backend/nims ./nims
COPY --from=assets /app/web/dist /app/web/dist
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

WORKDIR /app
RUN chmod +x /app/docker-entrypoint.sh

ENV PYTHONPATH=/app/backend
ENV API_HOST=0.0.0.0
ENV API_PORT=8080
ENV NIMS_RELOAD=false
ENV NODE_ENV=production

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# Trust X-Forwarded-* from the ALB (not 127.0.0.1) so url/client metadata and cookie Secure match viewer HTTPS.
CMD ["/app/backend/.venv/bin/python", "-m", "uvicorn", "nims.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
