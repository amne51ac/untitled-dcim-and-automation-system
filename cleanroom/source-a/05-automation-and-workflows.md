# Source Application A — automation and workflows

## Jobs

**Jobs** are the primary user-defined automation mechanism: Python classes packaged with the core install, shipped via Git repositories, or provided by apps. They run **on demand** or on a **schedule**, with optional **approval** gates.

### Capabilities

- Read and write inventory through the supported ORM and service layers  
- Prompt operators for inputs via declared variables (strings, integers, booleans, object pickers, file uploads, etc.)  
- Emit structured logs and status records suitable for auditing  
- Target optional **queues** (worker pools or Kubernetes job runners) for isolation or scale  

### Management

Each job class has a persisted record enabling enable/disable, metadata overrides, and cleanup of stale definitions when Git sources change.

## Job buttons

Jobs can be exposed as **buttons** on object detail screens when conditions match, shortening common operational paths.

## Job hooks

**Hooks** trigger jobs automatically when objects matching criteria are created, updated, or deleted—event-driven automation layered on change detection.

## Scheduling and approvals

- Schedules integrate with the background task system.  
- **Approval workflows** attach to models (and job scheduling) so sensitive actions require one or more approver groups in sequence before execution proceeds.  
- Denials and pending states are tracked per workflow stage.

## Device interaction (NAPALM)

Optional integration with the NAPALM library lets jobs or utilities retrieve **live** device state (facts, interfaces, etc.) for comparison against inventory. This is presented as a bridge between **documented intent** and **operational reality**, not as a full monitoring system.

## Import/export and compliance (conceptual)

Feature guides reference **data compliance** and **golden configuration** style workflows; those advanced scenarios often rely on **apps** built on top of core jobs and inventory. Core provides the hooks; specific compliance engines are extension territory.

## Kubernetes execution

For large or isolated workloads, jobs may run as **Kubernetes jobs** with documented wiring between the web app, queue broker, and cluster. This is an operational deployment pattern rather than a domain concept.
