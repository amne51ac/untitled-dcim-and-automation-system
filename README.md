# Network automation & DCIM platform (planning)

This repository captures **clean-room research** and a **product roadmap** for a new **network source of truth**, **DCIM**, and **network automation** platform aimed at **provider and distributor scale**: ISPs, backbone operators, hyperscale-adjacent network teams, and large infrastructure organizations that need **throughput**, **resilience**, and **operational maturity**—not lab-sized tooling.

The work is **inspired by** design lessons synthesized from multiple reference systems (documented under [`cleanroom/`](cleanroom/README.md) using neutral **Source A–H** and **Additional Source 1** designations). This codebase does **not** copy any third-party source; it is a **planning and specification** home for a greenfield implementation.

---

## Vision (one paragraph)

Build an **API-first**, **multi-region**, **multi-cloud**-deployable platform that is the **authoritative intent** for network and facility inventory, **orchestrates** change through safe automation, **integrates** with BSS/OSS-adjacent and cloud ecosystems where needed, and scales to **high cardinality** objects, **high write/read** API rates, and **always-on** operations—with **plugins**, **integrations**, and **policy** as first-class citizens.

---

## How we will use the cleanroom output

The [`cleanroom/`](cleanroom/README.md) tree holds **capability and architecture notes** derived from reference platforms (open-source and one commercial marketing survey). We use it in **four** concrete ways:

1. **Requirements & domain model** — Consolidate overlapping concepts (DCIM, IPAM, circuits, virtualization, cloud-adjacent objects, jobs, events) into a **single coherent model** tuned for **provider** semantics (tenancy, hierarchy, bulk operations, long-lived identifiers).
2. **Platform vs. product boundaries** — Decide what is **core platform** (auth, tenancy, audit, APIs, jobs, events, plugin host) versus **optional apps** (e.g. compliance, discovery adapters, reporting packs), using Source A’s automation-platform posture as a baseline and AS1’s “active inventory + orchestration + assurance” framing where it informs **operator-scale** packaging.
3. **Non-functional targets** — Translate comparison notes into **SLOs**: API latency under load, ingestion rates, worker throughput, RPO/RTO, multi-AZ behavior, and **horizontal** scaling stories for stateless tiers.
4. **Differentiation** — Explicitly borrow **ideas** (not code), e.g. lightweight IPAM ergonomics (Source C), asset lifecycle depth (Source D), DDI-adjacent patterns (Source E), observability adjacency (Source F), facility reporting (Sources G–H), and commercial **suite integration** patterns (Additional Source 1)—only where they fit **provider-scale** requirements.

Each subsection in [`cleanroom/source-a/`](cleanroom/source-a/INDEX.md) and sibling sources maps to **epics** in the implementation tracker (to be added as the SDLC matures).

---

## Roadmap phases (high level)

### Phase 0 — Foundation (this repo)

- Maintain **cleanroom** docs as the **traceability** backbone for requirements.
- Add **architecture decision records (ADRs)** for stack choices (language, DB, messaging, API styles).
- Define **coding standards**, **security baseline**, and **contribution** workflow.

### Phase 1 — Core platform skeleton

- **Identity & tenancy**: organizations, projects, RBAC/ABAC, audit log, API tokens, SSO hooks.
- **Data model v1**: locations, racks, devices, interfaces, cables, IPAM core, minimal circuits—**UUID** keys, **soft-delete** policy, **change** stream.
- **Public APIs**: versioned **REST**, **GraphQL read** path, **event** subscription contract (webhook + message bus).
- **Plugin host**: installable apps with **versioned** API surface and **isolated** failure domains.

### Phase 2 — Automation & scale

- **Job engine**: async execution, schedules, approvals, idempotency, **per-tenant** queues.
- **Git-backed artifacts** (config templates, policy bundles) with signed provenance.
- **Horizontal scale**: stateless API tier, **read replicas**, **cache** layer, **sharding** strategy for hottest tables if needed.
- **HA**: multi-AZ database, **zero-downtime** migrations, graceful **degradation** when workers lag.

### Phase 3 — Provider-grade operations

- **Bulk** import/export, **CSV** and structured interchange, **backpressure** on heavy jobs.
- **Observability**: metrics, traces, structured logs, **SLO** dashboards per tenant tier.
- **Multi-cloud**: reference **Kubernetes** deployments, **object storage** for artifacts, **secrets** integration.
- **Integrations**: ticketing, IPAM/discovery adapters, **northbound** BSS-style APIs where customers need them (without mandating a monolith).

### Phase 4 — Maturity & ecosystem

- **Certification** path for third-party apps; **marketplace** mechanics (optional).
- **Disaster recovery** runbooks and tested **restore** drills.
- **Compliance** packs (policy-as-code, data residency hooks) as **apps**, not forks.

---

## Non-functional requirements (targets)

| Area | Direction |
|------|-----------|
| **Capacity & volume** | Design for **millions** of inventory objects and **sustained** API traffic; batch and streaming **ingestion** paths. |
| **Availability** | **HA** control plane; **multi-AZ** data tier; clear **RPO/RTO** per deployment profile. |
| **Scalability** | **Scale-out** stateless services; **queue**-based workers; **partition**-friendly keys where sharding is needed. |
| **Security** | **Zero-trust**-friendly authn/z, **secrets** externalization, **encryption** in transit and at rest, **audit** on all mutating paths. |
| **Deployability** | **Helm**/**Kustomize** (or equivalent), **infra-as-code** examples, **air-gapped** options for regulated providers. |
| **Operability** | **SRE**-friendly metrics; **runbooks**; **feature flags**; safe **rollouts**. |
| **Extensibility** | **Plugins/apps** with stable contracts; **webhooks**; **event** fan-out; **custom fields** and **policy hooks** without core forks. |

---

## SDLC & quality bar

- **Trunk-based** or **short-lived** branches with **required** reviews for core.
- **CI**: lint, typecheck, unit/integration tests, **API contract** checks, **migration** tests.
- **CD**: staged environments; **canary** for risky changes; **automated** rollback criteria.
- **Documentation**: user docs, operator runbooks, **OpenAPI**/GraphQL schema as artifacts.
- **Supply chain**: pinned dependencies, **SBOM** generation, **CVE** response process.

---

## Repository layout (current)

```
cleanroom/          # Clean-room capability & design research (Source A–H, AS1)
docs/               # Contributor docs (e.g. publishing to GitHub)
README.md           # This plan
LICENSE             # Apache-2.0
```

Application code, infrastructure templates, and ADRs will land in dedicated directories as implementation begins.

---

## Naming & attribution

Reference systems are discussed in [`cleanroom/`](cleanroom/README.md) using **Source A**, **Source B**, etc., to avoid implying affiliation or endorsement. This project is **independent** greenfield work.

---

## License

See [`LICENSE`](LICENSE). Documentation and specifications contributed here are intended to be **open**; implementation code will follow the same license unless stated otherwise in subfolders.

---

## Publish to GitHub

Step-by-step **init, commit, and push** (including `gh repo create`) is in [`docs/PUBLISHING.md`](docs/PUBLISHING.md).
