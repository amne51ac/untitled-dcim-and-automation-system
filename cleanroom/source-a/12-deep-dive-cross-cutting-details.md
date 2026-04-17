# Source A — deep dive: cross-cutting architecture details

This note extends [`09-runtime-architecture-and-repository-inventory.md`](09-runtime-architecture-and-repository-inventory.md) with **additional subsystem detail** inferred from settings, dependency metadata, and package layout—still **no source excerpts**.

## Web stack and UI delivery

- **Dual template ecosystems:** classic Django templates plus a **Jinja** integration for specific rendering paths (export templates, some tooling).
- **Incremental UI:** documented patterns use **HTMX-style** partial updates in places to avoid full page reloads for common interactions.
- **Charts:** optional visualization components for dashboards and reports.
- **Static pipeline:** project-static assets include vendor editor bundles for in-browser editing experiences where applicable.

## API surface (beyond REST basics)

- **REST** is organized per domain app with OpenAPI schema generation and interactive Swagger and ReDoc entry points.
- **Version negotiation** via headers or query parameters allows clients to pin behavior across upgrades.
- **UI-specific JSON endpoints** under a dedicated prefix supply dynamic filter widgets, CSV import field discovery, and similar **SPA-adjacent** helpers without duplicating domain logic in the front end.

## GraphQL

- **Read-only** query surface; schema built from registered models and app contributions.
- Performance work includes guarding against **N+1** query patterns in test suites.
- Saved queries can be stored as first-class objects for repeatable reporting.

## Background execution

- **Celery** workers process queues for Git synchronization, job runs, scheduled tasks, and housekeeping.
- **Beat** schedules recurring work; results land in a results store integrated with Django.
- **Kubernetes** optional path isolates certain job workloads for scale or dependency containment.

## Git integration lifecycle

- Repositories clone under a configurable filesystem root; sync is **asynchronous** and produces standard **job result** records for operator visibility.
- Content types include jobs, config contexts, export templates, and **app-defined** datasource types registered in the platform registry.
- Private remotes require **secrets groups** with typed secret slots (for example HTTP bearer tokens), avoiding embedded credentials in repository records.

## Eventing

- **Brokers** (syslog, Redis pub/sub, extensible) receive structured payloads for create, update, delete, and user-oriented events.
- Topic naming follows predictable patterns so external automation can subscribe selectively.
- Configuration supports **include/exclude** topic lists per broker.

## Observability and operations

- **Structured request logging** ties HTTP requests to structured log entries.
- **Prometheus** metrics middleware optional for request and system metrics.
- **Health checks** include pluggable tests; database-backed file storage has dedicated checks.
- **Request profiling** tooling (Silk-class) can be enabled for development diagnostics.
- **Worker status** view exposes broker connectivity for operators.

## Data layer extras

- Optional integration with a **versioned SQL** engine allows branch contexts for experimental data workflows; standard deployments use conventional PostgreSQL or MySQL without that path.

## Security middleware chain

- Order spans CORS, sessions, CSRF, authentication, clickjacking protection, custom **remote user** header handling, **external auth enrichment** (default groups and object permissions for SSO/LDAP users), **object change context** binding, timezone, and metrics wrappers.

## Extension loading

- Apps use a **registry** with append-only stores for datasources, GraphQL participation, homepage layout, template injections, and feature flags per model.
- **Plugin packages** validate compatibility version ranges and merge optional middleware, Constance-style tunables, and navigation contributions.

## Testing and quality

- Large **core test suite** covers API, GraphQL, authentication, navigation, filters, Celery, events, UI tags, and release mechanics.
- **Factories** and schema helpers accelerate consistent test data creation.

This document is intentionally **non-exhaustive**; it deepens the runtime picture for implementers comparing Source A to other platforms.
