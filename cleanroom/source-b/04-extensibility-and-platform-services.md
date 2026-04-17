# Source B — extensibility and platform services

## Plugins

Plugins ship as Django apps with a **PluginConfig**-style class declaring **version bounds**, **middleware**, optional **django_apps** merged into `INSTALLED_APPS`, **django-rq queue** names, and an **events_pipeline** list merged globally.

Default **resource hooks** (by conventional import paths) include:

- **Search indexes** and **data backends** for global search extensibility.
- **GraphQL schema** contributions.
- **Navigation** menus and items.
- **Template extensions** injecting list/detail content.
- **User preferences** registration.

## Core extras (conceptual)

The **extras** app area hosts cross-model constructs: webhooks, export templates, custom fields, relationships (where applicable in this version lineage), job-like script storage, and similar—pattern aligns with Source A’s “platform services” idea but concrete models differ by release.

## Custom validation

Administrators can define **validation** and **deletion protection** rules so business policy is enforced at save/delete time.

## Registry pattern

A process-wide **registry** tracks installed plugins and contributions (menus, GraphQL fragments, template hooks)—supporting introspection in the UI.
