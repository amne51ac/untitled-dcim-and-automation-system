# Source Application A — APIs and events

## REST API

- **CRUD** operations map to HTTP verbs; partial updates use patch-style semantics.  
- **Filtering** on list endpoints follows a documented query parameter vocabulary shared with the UI.  
- **Versioning** is available via headers or query parameters so clients can negotiate schema generations.  
- **Pagination** follows common list patterns; **OPTIONS** on endpoints advertises capabilities.  
- Nested and hyperlink-style responses reference related objects by URL for discovery.

## GraphQL

- Exposes **read-only** queries (no mutations in current documented scope).  
- Supports **variables** and a browser IDE for exploration.  
- Custom field data is exposed in documented shapes (for example consolidated maps versus per-field accessors).  
- Schema coverage tracks models registered for GraphQL support.

## Webhooks

Administrators define outbound HTTP calls on **create**, **update**, and **delete** for selected object types. Payloads and headers may be **templated** with a Jinja-compatible language. Optional **HMAC** signing protects receivers. SSL verification can be relaxed or pinned with custom trust stores when required (with operational caution).

## Event notification system

A newer internal **publish** model emits structured **change events** and **user events** to pluggable brokers. Built-in adapters include syslog and Redis pub/sub; apps may register additional brokers. Event names follow predictable patterns based on app label and model. Payloads include **before/after** snapshots and a **diff** summary suitable for automation.

Future direction (per public docs): webhooks and hooks may eventually consume the same event stream for consistency.

## Change logging

Two layers coexist:

1. **Administrative audit** via the web framework’s admin log for staff-managed configuration objects.  
2. **Domain object changelog** capturing serialized representations before and after changes, with user, timestamp, and a **request correlation identifier** so bulk edits group cleanly.

Changelog entries are readable in the UI and via read-only API and GraphQL surfaces; export formats exist for offline analysis.

## Saved GraphQL queries

Users may store named GraphQL queries for reuse—helpful for repeated reporting or integration prototypes.

## Authentication for APIs

Token-based access is standard; session authentication applies to browser use. Specific schemes and header formats are described in upstream operator documentation—not duplicated here.
