# Source B — documentation index

Independent design and capability notes for **Source B** (Apache 2.0 reference network source-of-truth platform). Clone path: `netbox/` (see [`../METHODOLOGY_AND_LOG.md`](../METHODOLOGY_AND_LOG.md)).

## Executive summaries (01–08)

| Document | Topics |
|----------|--------|
| [01-overview-and-purpose.md](01-overview-and-purpose.md) | Mission, relationship to Source A, positioning as intended-state inventory. |
| [02-architecture-and-runtime.md](02-architecture-and-runtime.md) | Django apps, HTMX, django-rq, Strawberry GraphQL, middleware, deployment posture. |
| [03-domain-models-and-capabilities.md](03-domain-models-and-capabilities.md) | DCIM, IPAM, circuits, virtualization, VPN, wireless, tenancy—capability themes. |
| [04-extensibility-and-platform-services.md](04-extensibility-and-platform-services.md) | Plugins, custom fields, validation, extras, search and data backends. |
| [05-automation-and-workflows.md](05-automation-and-workflows.md) | Custom scripts, reports, django-rq queues, event rules, configuration rendering. |
| [06-apis-and-integration.md](06-apis-and-integration.md) | REST, OpenAPI, GraphQL, webhooks/event pipeline, plugin API routes. |
| [07-security-and-governance.md](07-security-and-governance.md) | Auth (OAuth, remote user), object permissions, tenants, change logging. |
| [08-user-interface-and-operations.md](08-user-interface-and-operations.md) | UI areas, HTMX widgets, maintenance mode, metrics, internationalization. |

## Deep architecture (09)

| Document | Topics |
|----------|--------|
| [09-repository-deep-dive-and-comparison-to-source-a.md](09-repository-deep-dive-and-comparison-to-source-a.md) | Plugin contract, events pipeline, RQ vs Celery vs Source A, repository-level observations. |

For **Source A** (primary target), see [`../source-a/INDEX.md`](../source-a/INDEX.md). For other platforms, see [`../reference-platforms/INDEX.md`](../reference-platforms/INDEX.md).
