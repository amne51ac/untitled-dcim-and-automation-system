# Source B — APIs and integration

## REST API

- Organized by domain app under a common API root.
- **OpenAPI 3** schema via **drf-spectacular**; interactive **Swagger** and **Redoc** UIs.
- **Status** and **authentication-check** endpoints assist client bootstrap and health probes.

## GraphQL

- Exposed through a dedicated view bound to a schema object; **Strawberry**-oriented stack per dependencies.
- Plugins may contribute **GraphQL schema** fragments through declared resource paths.

## Webhooks and events

- **Webhooks** fire HTTP callbacks on defined changes.
- Plugin **events_pipeline** entries allow custom event processing stages in addition to core behavior.

## Integration posture

Source B is designed as a **data hub**: monitoring, provisioning, and assurance tools **pull** or **subscribe** via APIs and webhooks. It does not attempt to be a full NMS—contrast **Source F** (monitoring-first suite).
