# Source B — user interface and operations

## Navigation model

Menus align with domain areas (DCIM, IPAM, circuits, etc.); **plugins** inject additional entries through the plugin API.

## List and detail UX

**django-tables2** drives sortable, filterable lists. **HTMX** powers partial reloads for selectors and similar widgets without full SPA complexity.

## Internationalization

**Locale** middleware supports translated operator experiences where community translations exist.

## Observability

Optional **Prometheus** middleware exposes request-level metrics when enabled—fits Kubernetes or VM deployments with standard scraping.

## Media and images

Thumbnail support assists rack elevation and device imagery workflows.

## Operations

Typical deployment: application servers, Redis for RQ, PostgreSQL, reverse proxy TLS termination. Follow upstream installation guides for production hardening.
