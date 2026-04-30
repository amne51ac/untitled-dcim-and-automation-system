# Platform implementation (`platform/`)

IntentCenter **Phase 1** stack: **FastAPI** (`backend/nims`), **PostgreSQL**, **Prisma** for migrations only, **React + Vite** (`web/`).

## Web console

- **Build**: from `platform/`, `npm run web:build` (or `npm run web:dev` for Vite only). Output is `web/dist`, which the API can serve under `/app/`.
- **Pinned pages**: stored in `User.preferences` (JSON), updated via `PATCH /v1/me` with `{ "preferences": { "pinnedPages": [ { "path": "/dcim/devices", "label": "Devices" } ] } }`.
- **Pin / Unpin** lives in the **page header** **⋯** menu (`ModelListPageHeader` + `PageActionsMenu`), not in the sidebar.
- **Sidebar**: pinned links first (below the brand), then global search, then **collapsible** nav sections (state in `localStorage` keys `nims.sidebar.*`).
- **List pages** use `ModelListPageHeader` for Add / bulk / pin; tables use `DataTable` + `RowOverflowMenu` (Copy, Archive, Delete) where applicable.

## Sign-in & identity (admin)

Identity settings are stored per **organization** in `Organization.identityConfig` (JSON, Prisma migration `20260429130000_org_identity_config`) and merged with **environment variables** where set (env wins; those values are read-only in the UI).

- **Admin UI (ADMIN only):** `/app/platform/admin/identity` — checkbox for **email and password**, radio group for **at most one** external directory (none, LDAP, Microsoft Entra, OpenID Connect), only the selected directory’s fields shown; **Save changes** enabled only when there are unsaved edits.
- **API:** `GET /v1/admin/identity`, `PATCH /v1/admin/identity` (same access as other admin routes).
- **Public (unauthenticated):** `GET /v1/auth/providers` — which sign-in methods are **enabled** for the first organization, using merged env + DB config.
- **Secrets:** IdP secrets saved in the database are encrypted at rest (`IDENTITY_ENCRYPTION_KEY` or derived from `JWT_SECRET`); the admin API never returns plaintext secrets to the browser (masked or omitted).

Full variable list and behavior: [`docs/design-auth-user-management.md`](../docs/design-auth-user-management.md) and [`.env.example`](.env.example).

## API touchpoints for the UI

| Feature | Endpoint |
|--------|-----------|
| Search | `GET /v1/search?q=&limit=` |
| Me / preferences | `GET /v1/me`, `PATCH /v1/me` |
| Sign-in options (login page) | `GET /v1/auth/providers` |
| Identity config (admin) | `GET /v1/admin/identity`, `PATCH /v1/admin/identity` |
| Bulk CSV/JSON | `GET /v1/bulk/{resourceType}/export`, `POST /v1/bulk/{resourceType}/import/csv`, `POST /v1/bulk/{resourceType}/import/json` (core types + catalog types — see `bulk.py`) |
| Object view (UI) | `GET /v1/resource-view/{resourceType}/{id}` — item fields + graph |
| Graph only | `GET /v1/resource-graph/{resourceType}/{id}` — relationship graph JSON |

For full run instructions, database setup, and CI, see the repository root [`README.md`](../README.md).
