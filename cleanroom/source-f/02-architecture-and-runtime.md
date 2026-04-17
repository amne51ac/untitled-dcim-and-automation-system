# Source F — architecture and runtime

## Language mix

Predominantly **Python** with **JavaScript** for UI, **PostgreSQL** (PLpgSQL in stats), **Django** under `python/nav/django` for modern web components.

## Major subsystems (directory names)

- **ipdevpoll** — scheduled SNMP collection.
- **eventengine** / **alertengine** — event processing and alerting.
- **topology** / **netmap** — graph and map generation.
- **portadmin** — switch port configuration workflows.
- **metrics** — time-series integration.
- **dhcpstats** / **activeipcollector** — address usage visibility.
- **snmptrapd** — trap ingestion.
- **web** — operator UI; **models** — ORM layer.
- **mibs**, **enterprise**, **junos** — vendor specifics.
- **report**, **auditlog**, **mailin**, **smsd** — reporting and notifications.

## Deployment

Debian packages, source builds, and developer Docker documented—production hardening per operator guides.
