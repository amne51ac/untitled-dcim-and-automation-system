# Source Application A — platform and extensibility

## Application registry

Core maintains an in-process **registry** of feature metadata: which models participate in GraphQL, custom fields, relationships, and similar concerns. Extensions can register datasources, homepage panels, and other contributions. The registry is described as **append-only** for keys—stability for plugins and core alike.

## Apps (plugins)

Third-party packages integrate as first-class Django apps. They may add:

- New models, tables, and admin integration  
- REST routes and UI views  
- Job classes and Git-provided content types  
- Navigation entries, banners, and home page widgets  

Documentation emphasizes reusing platform primitives instead of rebuilding auth, permissions, or logging.

## Custom fields and computed fields

Administrators define **custom fields** per content type with typed widgets (text, selection, numeric, object references, and so on). **Computed fields** derive values from templates evaluated in context, exposing read-only derived data alongside stored fields.

## Relationships between objects

A **relationships** subsystem lets users define new edges between model types beyond built-in foreign keys. Cardinalities include one-to-one, one-to-many, many-to-many, and symmetric variants for peer graphs. Relationships may be **required** on one side, enforced on create and update paths including bulk operations. Optional **filters** limit valid peers using the same filter vocabulary as list APIs.

## Config contexts

Structured key-value documents apply to objects using hierarchical rules (global, by location, by role, by tag, device-local, and combinations). Contexts can be authored in the database and/or **loaded from Git** as JSON or YAML under documented directory conventions.

## Git as a data source

Registered repositories clone to a server-local path. Supported content types include **jobs**, **config contexts**, **export templates**, and **app-defined** datasource types. Sync is asynchronous; results surface as standard job-result records. Private remotes use **secrets groups** rather than embedding credentials in job code.

## Export templates and rendering

Templates can render objects to textual formats for export or external systems, often maintained alongside Git workflows.

## Data validation engine

User-defined **validation rules** attach to models and fields. Rule families include numeric min/max, regular expressions, required fields, and uniqueness constraints, with customizable error messages. This layer complements rather than replaces schema-level constraints.

## Tags, roles, statuses

Cross-cutting classification uses **tags**, **functional roles**, and **status** records so automation and reporting can rely on stable labels.

## Dynamic groups

Explained in depth in domain docs: groups combine **filter-based**, **set-based**, and **static** membership. Membership is **cached** to accelerate reverse lookups from an object to its groups.

## Webhooks and integration templates (cross-reference)

See [06-apis-and-events.md](06-apis-and-events.md) for outbound HTTP notifications; platform **Jinja** environments also appear in webhooks, export templates, and computed contexts.
