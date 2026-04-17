# Source B — architecture and runtime

## Application stack

- **Framework:** Python **Django** with first-party apps: **core**, **account**, **dcim**, **ipam**, **circuits**, **tenancy**, **virtualization**, **extras**, **vpn**, **wireless**, **users**, **utilities**, plus **reports** and **scripts** for packaged automation artifacts.
- **Front end:** **HTMX** middleware enables partial-page interactions (e.g. object selectors). **django-tables2** supports list views; **sorl-thumbnail** handles images.
- **API layer:** **Django REST Framework** with **drf-spectacular** for OpenAPI schema and Swagger/Redoc.
- **GraphQL:** **strawberry_django** (and related imports) indicates a **Strawberry**-oriented GraphQL layer alongside REST—distinct from Source A’s Graphene-style read-only GraphQL.
- **Async work:** **django-rq** backed by **Redis**; plugins may register **named queues** merged into a global queue map—contrast with Source A’s **Celery**-centric design.

## Middleware and operations

- **CORS**, sessions, **locale** (i18n), CSRF, authentication, messages, security headers.
- **Remote user** middleware for reverse-proxy SSO.
- **Core** and **maintenance mode** middleware for upgrades and gated access.
- Optional **Prometheus** before/after wrappers when metrics are enabled.

## Data store

- Relational database (PostgreSQL-class in typical deployments; follow upstream operator docs).

## URL topology (conceptual)

Browser routes group by domain: circuits, core, DCIM, extras, IPAM, tenancy, users, virtualization, VPN, wireless, account. **HTMX** endpoints serve widget-style partials. **API** and **GraphQL** expose machine-facing surfaces. **Plugins** mount under configurable prefixes for HTML and REST.
