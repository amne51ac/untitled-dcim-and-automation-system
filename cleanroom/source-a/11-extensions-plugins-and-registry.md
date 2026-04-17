# Source Application A — extensions, plugins, and registry contract

## Terminology

The codebase distinguishes **core Django apps** from **add-on packages** installed through configuration. Add-ons use a specialized application configuration class that declares metadata, compatibility bounds, and optional integration hooks. URLs mount under separate **apps** and **legacy plugins** prefixes, but the extension mechanism is conceptually unified: both provide models, views, APIs, and background behavior.

## Plugin (app) configuration contract

An add-on’s configuration class carries:

- **Identity and packaging:** author, description, semantic version, minimum and maximum supported platform versions.
- **Routing:** optional custom base URL segment; default falls back to the app label.
- **Embedded dependencies:** extra Django apps or middleware lists merged at startup when the add-on loads.
- **Runtime tuning:** default and required settings keys validated before activation; optional integration with runtime-tunable admin settings.
- **Feature flags:** ability to mark jobs as dynamically reloadable at runtime.

Declared **integration entry points** are conventional submodule paths resolved by import. If a submodule is absent, that feature is simply skipped. Documented categories include:

- Banners injected atop the UI when conditions match.
- Custom model validators registered centrally.
- Additional Git datasource types and refresh callbacks.
- Extra GraphQL object types merged into the schema.
- Homepage panel layouts and weights.
- Job module discovery.
- Prometheus metrics discovery hooks (with opt-out per app).
- Navigation menu contributions.
- Template content injections for list and detail pages of specified models.
- Secrets provider backends for retrieving credentials without storing them in code.
- Extensions to list filters and filter forms for existing models.
- Table column and rendering extensions for list views.
- Optional view class overrides replacing selected core views.

Add-ons may also ship **Jinja filter modules** discovered by conventional import.

## Registry and feature discovery

A process-wide registry holds **append-only** stores: datasource definitions, GraphQL-capable models, homepage layout fragments, plugin-registered GraphQL types, template extensions, custom validators, metrics registrations, and similar. The registry is intended for internal and extension use, not arbitrary mutation after startup.

## URL and API registration

During application startup, each add-on:

- Optionally appends UI and REST URL patterns under its base path.
- Records pattern metadata for an **installed apps** introspection UI (pattern names, routes, models exposed).
- Clears URL resolution caches when patterns change so new routes become visible immediately.

## Template extension model

Authors subclass a template extension base class, pinning content to a specific model identifier string. Methods on the subclass supply fragments for list views, detail views, or navigation sidebars. The core template pipeline queries registered extensions when rendering matching pages.

## Validation and safe failure modes

Add-on configuration validation enforces data types for lists and dictionaries, required settings presence, and semantic version bounds against the running platform. Misconfiguration raises explicit configuration errors at load time rather than failing mid-request.

## Dynamic jobs

When enabled, an add-on may reload job modules on demand for faster iteration; this trades convenience against stricter production immutability expectations.

## Interaction with core signals

Add-ons can subscribe to a **database ready** signal to defer work until models are fully installed—commonly used to register metrics after tables exist.

## Secrets providers

Beyond built-in secret storage patterns, add-ons register callable providers that resolve credential material for Git, webhooks, or external integrations using whatever vault or cloud API the enterprise prefers.

## Filter and table extensions

Extensions declare additional query predicates or form fields for existing model filter sets, and can augment django-tables2-style renderings so list pages show app-specific columns without forking core templates.

## View overrides

Qualified view names can be mapped to replacement class-based views, allowing surgical UI customization while leaving the rest of the object UI intact.

## Summary

Source Application A’s extension model favors **convention-over-configuration** (fixed submodule paths), **explicit capability flags**, and **central registries** so operators can see what each installed package contributes. This reduces opaque monkey-patching while keeping extension surfaces broad enough for domain-specific network automation applications.
