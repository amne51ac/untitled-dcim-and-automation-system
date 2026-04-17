# Source Application A — overview and purpose

## Mission

**Source Application A** is a web-centric **network source of truth** and **network automation platform**. It is intended to hold the intended state of network infrastructure and to integrate with automation tooling through APIs, eventing, and user-defined automation.

## Primary use cases (conceptual)

1. **Flexible inventory and intent**  
   Core and extended data models describe devices, addressing, connectivity, tenancy, and related objects. The platform emphasizes flexibility: user-defined attributes, cross-object links, and validation so organizations can encode naming rules, required fields, and other policies.

2. **Integration hub**  
   The system exposes programmatic interfaces (REST and read-only GraphQL), outbound notifications (webhooks), optional event streaming to brokers, and Git-backed content. It is designed to feed configuration management, monitoring, and orchestration pipelines.

3. **Application platform**  
   An extension model allows additional Python packages (“apps”) to add models, APIs, UI, and automation. Extensions can reuse platform services such as authentication, permissions, change logging, and job execution.

## Scale of the core model

Public documentation states that **on the order of hundreds** of core database models exist before counting any third-party apps. The UI and APIs are organized so operators navigate by functional area (for example facilities and devices, IP addressing, circuits, platform utilities).

## Lineage (factual, high level)

Public notices in the upstream project state that Source Application A was initially derived from an earlier open-source network inventory application. That heritage explains conceptual similarity in some domain areas (for example DCIM and IPAM patterns) while the current platform has diverged with its own features (relationships, jobs, cloud and load-balancer models, and so on). This document does not reproduce any third-party notices verbatim.

## What this document set does not claim

These notes do not assert feature parity with any other product, nor do they specify version numbers unless needed for clarity. They describe **categories of capability** as understood from documentation structure and module organization.
