# Source Application A — repository scale, layout, and runtime architecture

This note summarizes the **structure and cross-cutting runtime** of the upstream codebase as observed by enumerating packages, settings, and URL configuration. It does not reproduce source listings.

## Approximate repository scale (main application package)

A filesystem survey of the primary Python package directory shows **on the order of 1,100** Python modules and **roughly 1,900** text-oriented assets (Markdown, HTML, JavaScript, CSS, and Python combined). Automated tests, migrations, static vendor bundles, and documentation inside the tree contribute to that count. This confirms a **large, mature** web application with broad surface area rather than a thin service.

## Django applications (core install)

The central settings module wires a fixed set of first-party Django apps. Together they form Source Application A’s built-in functionality:

- **Core framework package** — shared infrastructure (URLs, API plumbing, UI helpers, GraphQL, Celery integration, events, middleware, model base classes, management commands, CLI, etc.).
- **Circuits** — providers, circuit inventory, terminations, provider networks.
- **Cloud** — accounts, resource typing, networks, services, prefix and service attachment join models.
- **Data validation** — declarative validation rules plus a compliance-oriented aggregate type.
- **DCIM** — facilities, racks, devices, modules, cabling, power, software images/versions, controllers, redundancy constructs, virtual device contexts, and related templates.
- **Extras** — platform services: jobs, webhooks, Git repositories, custom fields, relationships, tags, statuses, roles, secrets, dynamic groups, approvals, notes, saved views, export tooling, GraphQL query storage, metadata, contacts, and change logging mixins.
- **IPAM** — namespaces, VRFs, route targets, RIRs, prefixes, addresses, VLANs, services, and VRF or VLAN assignment join tables.
- **Load balancers** — virtual servers, pools, members, health checks, certificate profiles, and assignment join tables.
- **Tenancy** — tenant groups (hierarchical) and tenants.
- **Users** — extended user model, API tokens, object-level permissions, admin group typing.
- **Virtualization** — cluster taxonomy, clusters, virtual machines, VM interfaces.
- **VPN** — IKE/IPsec-oriented profiles and policies, VPN instances, tunnels, endpoints, and termination records.
- **Wireless** — radio profiles, wireless networks, supported data rates, and controller group assignment tables.

Third-party Django apps in the same settings list provide REST framework integration, OpenAPI generation, GraphQL bindings, filtering, tables, tagging, health checks, Prometheus metrics, request profiling (Silk), structured logging, CORS, social authentication, and runtime-tunable settings (Constance pattern).

## Web URL topology (conceptual)

Browser routes group under path prefixes such as circuits, cloud, data validation, DCIM, extras, IPAM, load balancers, tenancy, users, virtualization, VPN, and wireless. **Core** views handle home, global search, about, authentication, metrics (optional), media, worker status, Jinja rendering utilities, and theme preview.

Two extension mount points appear: one for **packaged apps** using a modern apps URL namespace and another for **legacy plugin** URL patterns—reflecting an evolutionary split while keeping backward compatibility.

Administrative and operational endpoints include a customized admin site, health checks, optional authenticated metrics, Celery worker status, and secured file download routes for database-stored attachments.

## REST API topology (conceptual)

The API root mirrors the domain apps (same list as above) under a single API prefix. Additional endpoints expose OpenAPI schema in multiple formats, interactive Swagger and ReDoc, a JSON schema for **settings** (for UI-assisted configuration), a combined GraphQL-over-HTTP entry, status, and **UI-helper** APIs (for example dynamic filter field metadata and CSV import hints). App extensions register parallel API trees under both apps and legacy plugin API prefixes.

## Middleware pipeline (behavioral summary)

Request processing layers include:

- Metrics collection wrapping requests.
- Cross-origin handling for API clients.
- Session and standard security headers.
- Cross-site request forgery protection.
- Authentication and structured request logging.
- Custom **exception** handling to unify API and HTML error behavior.
- Configurable **remote user** authentication with a user-defined HTTP header when that mode is enabled.
- **External authentication enrichment** that can assign default groups and object permissions when LDAP, SSO, or similar remote backends authenticate a user.
- **Object change context** middleware that binds each request to a change-logging context so create/update/delete operations record actor, correlation identifiers, and channel (web, job, ORM, etc.).
- **Per-user time zone** selection for display consistency.
- Closing metrics hooks.

This design separates **transport and identity** concerns from **domain auditing**.

## Background processing

Celery is integrated for asynchronous tasks, scheduled jobs, beat-driven schedules, and result persistence. Encoders and custom control paths support operational tooling. Kubernetes-oriented execution paths exist for isolating certain jobs.

## Event publication

An internal **event broker** abstraction allows registering multiple brokers at startup (for example syslog and Redis pub/sub). Configuration supports per-broker topic include/exclude lists. Publication fans out object lifecycle and user-oriented events to all registered brokers. Loading is defensive: misconfigured broker classes fail loudly at startup rather than silently dropping events.

## GraphQL

Core hosts schema initialization, type generation utilities, and performance-oriented tests (for example guarding against excessive database fan-out). The public contract remains **query-only** in typical deployments.

## Optional database branching

The core tree includes integration points for a **versioned SQL database** that supports named branches and automatic commit semantics. When that backend is not in use, branch context becomes a no-op so the same code paths run on standard PostgreSQL or MySQL deployments.

## Developer and operator tooling

Management commands cover database migrations, post-upgrade hooks, test data generation, secrets generation, content-type cache refresh, GraphQL query auditing, dynamic group auditing, installation metric submission, and model validation. A small CLI supports migration assistance for template and UI framework upgrades.

## Testing infrastructure

The core package contains extensive unit and integration tests spanning authentication, APIs, GraphQL, navigation, filters, forms, Celery, events, UI components, and release mechanics. Factory helpers and schema utilities support consistent test data construction.

## UI framework (infrastructure layer)

Dedicated subpackages implement **navigation**, **breadcrumbs**, **homepage** composition, **object detail** tabbing, **charts** integration, bulk action buttons, and template tag libraries for permissions and UI widgets. View layers use router patterns that register many **view sets** per model for list/detail/create/edit/delete flows with shared behaviors.

## Static assets and documentation serving

The application can serve bundled static media, host embedded documentation for installed apps under configurable routes, and fall back to error pages when static collection fails in a given environment.

## Dependencies (category-level)

Beyond Django and the database, notable dependency families include: REST and schema tooling, GraphQL, Celery and Redis clients, Git integration, filtering and tables, tagging, tree queries for hierarchies, health and metrics, profiling, structured logging, cryptography, SSO helpers, and template engines (Django templates plus Jinja for specific features).
