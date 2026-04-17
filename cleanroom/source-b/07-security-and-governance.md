# Source B — security and governance

## Authentication

- Session-based web login; **social_django** enables OAuth-style providers.
- **Remote user** header flow for reverse-proxy authentication (SSO integration patterns).

## Authorization

- **Object-level permissions** with tenant-scoped and role-based patterns—administrators can constrain teams to subsets of objects (e.g. cabling-only, per-tenant).

## Audit

- **Change logging** records create/update/delete with user attribution and correlated request IDs for bulk operations.

## Operational safety

- **Maintenance mode** middleware can block user traffic during upgrades.
- **Custom validation** and **deletion rules** protect critical records from accidental removal.
