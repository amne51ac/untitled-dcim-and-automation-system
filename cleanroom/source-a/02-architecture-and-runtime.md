# Source Application A — architecture and runtime

## Application style

Source Application A is a **server-rendered web application** with rich browser UI, backed by a **relational database** and **background workers**. The implementation stack centers on a major Python web framework commonly used for data-driven enterprise apps, with a REST API layer and template-driven pages.

## Data persistence

- Primary datastore: **PostgreSQL** or **MySQL** (documented as supported options).
- Object identities exposed in APIs are often **UUIDs**, supporting stable references across imports and integrations.

## Request handling and APIs

- **REST** endpoints are grouped by major functional area (for example device inventory, IP addressing, platform “extras,” tenancy, circuits, virtualization, plugins).
- **OpenAPI-style** interactive documentation is available on a running instance for discovery and trial calls.
- **GraphQL** is supported for **read queries** (not mutations in the documented feature set).

## Asynchronous and scheduled work

- **Background task queues** process long-running operations (for example Git synchronization, job execution, housekeeping).
- **Scheduled tasks** integrate with job execution and approval flows.
- Optional execution targets include **Kubernetes** for isolated or scaled job runs (documented as an advanced mode).

## Caching and performance

The platform uses conventional patterns: configurable caching (often backed by Redis-class stores), query optimization hooks, and documented guidance for deployment tuning. Exact settings are operational concerns rather than core domain design.

## Observability

Hooks exist for **structured logging**, **health checks**, and **metrics** (for example Prometheus-compatible endpoints). These support production monitoring without changing core domain semantics.

## Static and uploaded assets

The web tier serves static assets for the UI; optional object **attachments** and **file** inputs exist for jobs and records where applicable.

## Configuration model

Runtime behavior is driven by a central configuration module (environment-specific). Important categories include database connectivity, authentication backends, cache and message broker URLs, feature flags, and paths for Git checkouts and file storage. No configuration excerpts appear in this clean-room folder.
