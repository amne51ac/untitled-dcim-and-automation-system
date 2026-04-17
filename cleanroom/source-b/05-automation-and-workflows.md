# Source B — automation and workflows

## Custom scripts

**Scripts** encapsulate Python logic with UI prompts for parameters—suited to provisioning workflows (e.g. bulk prefix creation). Execution is tied to **django-rq** workers rather than Source A’s Celery job registry.

## Reports

**Reports** generate structured output (tabular, exportable) from inventory queries—complementary to scripts (read-heavy vs read/write).

## Background processing

**Redis Queue** workers process asynchronous tasks including plugin-scoped queues. Plugin authors declare queue names; settings merge them into the deployment’s RQ configuration.

## Event-driven automation

**Event rules** connect object lifecycle transitions to **scripts** or **webhooks**, enabling integration with ticketing, monitoring, or IPAM downstream systems without polling the entire database.

## Configuration templates

Templates render **device configuration** text from inventory variables—optionally synchronized from **Git** per product documentation—supporting “single source of truth” render pipelines for Ansible/Salt-style consumption.
