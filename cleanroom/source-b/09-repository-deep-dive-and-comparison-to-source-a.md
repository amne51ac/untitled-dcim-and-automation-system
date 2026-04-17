# Source B — repository deep dive and comparison to Source A

## Repository-level observations

- **Monolithic Django project** with large `netbox` package, extensive tests, translations, and static asset pipeline.
- **Plugin subsystem** mirrors Source A’s extension philosophy: installable packages contribute URLs, APIs, GraphQL, search, and UI fragments.
- **Monkey-patch notes** appear in settings for advanced DRF/strawberry behaviors—signals a mature codebase working around edge cases in upstream libraries.

## Plugin contract summary

Plugins declare **queues**, **middleware**, **events_pipeline** stages, optional **django_apps**, and resource modules for search, GraphQL, navigation, templates, and preferences. Validation enforces **min/max NetBox version** compatibility.

## Comparison to Source A (primary target)

| Area | Source B | Source A |
|------|----------|----------|
| **Job execution** | Scripts + **django-rq** | Unified **Job** model, **Celery**, schedules, approvals |
| **Git integration** | Config templates (documented); narrower Git product surface | **GitRepository** model: jobs, config contexts, export templates, extensible datasources |
| **GraphQL** | **Strawberry**-oriented | **Graphene**-style, read-only queries in documented scope |
| **Events** | Plugin **events_pipeline** | Pluggable **event brokers** (Redis, syslog, custom) with topic filters |
| **Branching DB** | Not a headline feature | Optional **versioned SQL** branch contexts |

## When to cite Source B in a greenfield design

Use Source B as the **baseline SoT + plugin + RQ + GraphQL** reference. Use Source A when the product must prioritize **network automation platform** features: **first-class jobs**, **GitOps-style content**, **approval workflows**, and **multi-broker events**.
