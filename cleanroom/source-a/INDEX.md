# Source Application A — documentation index

Independent design and capability notes for **Source Application A** (network source of truth and automation platform).

## Executive summaries (01–08)

| Document | Topics |
|----------|--------|
| [01-overview-and-purpose.md](01-overview-and-purpose.md) | Mission, primary use cases, lineage context (high level). |
| [02-architecture-and-runtime.md](02-architecture-and-runtime.md) | Web stack, data store, async work, caching, observability hooks. |
| [03-domain-models-inventory.md](03-domain-models-inventory.md) | DCIM, IPAM, circuits, virtualization, cloud, load balancers, VPN, wireless, tenancy, supporting objects. |
| [04-platform-and-extensibility.md](04-platform-and-extensibility.md) | Apps/plugins, registry, custom fields, relationships, config contexts, Git-as-data-source, validation, tags, roles, secrets. |
| [05-automation-and-workflows.md](05-automation-and-workflows.md) | Jobs, scheduling, hooks, approval workflows, NAPALM integration. |
| [06-apis-and-events.md](06-apis-and-events.md) | REST, GraphQL, webhooks, event brokers, change logging. |
| [07-security-and-governance.md](07-security-and-governance.md) | Authentication, permissions, UI vs admin surfaces, auditability. |
| [08-user-interface-and-operations.md](08-user-interface-and-operations.md) | Navigation, search, saved views, deployment and configuration (conceptual). |

## Deep architecture and spec (09–11)

| Document | Topics |
|----------|--------|
| [09-runtime-architecture-and-repository-inventory.md](09-runtime-architecture-and-repository-inventory.md) | Repository scale, Django app list, URL and API topology, middleware, Celery, events, GraphQL, optional DB branching, tooling and tests. |
| [10-domain-model-catalog.md](10-domain-model-catalog.md) | Per-app inventory of models and join tables (vocabulary-level catalog). |
| [11-extensions-plugins-and-registry.md](11-extensions-plugins-and-registry.md) | Add-on configuration contract, registry stores, extension hooks (jobs, GraphQL, UI, filters, secrets, overrides). |

## Extended deep dive (12)

| Document | Topics |
|----------|--------|
| [12-deep-dive-cross-cutting-details.md](12-deep-dive-cross-cutting-details.md) | Additional cross-cutting detail: UI/HTMX, API helpers, GraphQL performance stance, Celery/Git/events/observability/security/testing—extends 09. |

The 01–08 series remains the readable overview; **09–12** add systematic and extended coverage aligned with the codebase layout. None of these files are API references or substitutes for operator runbooks.

For **industry comparison**, see **Source B** through **Source H**: each has its own subdirectory [`../source-b/`](../source-b/INDEX.md) … [`../source-h/`](../source-h/INDEX.md), linked from [`../reference-platforms/INDEX.md`](../reference-platforms/INDEX.md).

For a **commercial CSP OSS/BSS** reference (public marketing only, not open-source), see **Additional Source 1** — [`../additional-source-1/INDEX.md`](../additional-source-1/INDEX.md).
