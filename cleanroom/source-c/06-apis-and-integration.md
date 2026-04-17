# Source C — APIs and integration

## JSON API

A dedicated **`app/json`** area indicates **REST-style** JSON controllers for programmatic CRUD and queries—refer to upstream API documentation for authentication schemes and versioning.

## External systems

**OpenSearch**, **PowerDNS**, and **scanning** hooks (file names) imply integration points for discovery and DNS alignment—not a unified event bus like Source A.

## Contrast with Source A

Source A exposes **versioned REST**, **GraphQL**, and **webhooks** as platform pillars. Source C targets **pragmatic REST** for scripting—adequate for many integrations without GraphQL breadth.
