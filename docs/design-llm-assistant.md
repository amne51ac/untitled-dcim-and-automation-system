# Design: LLM-assisted operations (IntentCenter)

**Status:** Draft  
**Last updated:** 2026-04-20  
**Related:** [Architecture & design visuals](architecture.md), [Platform README](../platform/README.md)

---

## 0. Non-negotiable: preview and permission for destructive work

**Requirement:** Whenever the assistant workflow would perform a **destructive** change (see §5.5), the product **must**:

1. **Show a preview** of the exact change set before any mutating API call runs—human-readable summary plus structured detail (objects, operations, field deltas, bulk row counts, replace vs append semantics).
2. **Obtain explicit permission** from the user to proceed (a deliberate confirmation control—not navigation alone, not implied consent from the chat turn).
3. **Execute only after** that confirmation; a single chat message or model output must **not** apply destructive changes automatically.

**Server-side enforcement:** The orchestrator **must not** invoke mutating endpoints for destructive operations unless the request carries a **valid consent artifact** for that specific preview (e.g. short-lived, signed **apply token** bound to user, tenant, payload hash, and expiry). The LLM must never receive credentials or bypass this gate.

Non-destructive creates/updates may follow the same preview pattern for consistency; **destructive** paths are mandatory.

---

## 1. Summary

This document specifies an **LLM-assisted layer** on IntentCenter: grounded answers, draft change bundles, and import/reconciliation help—without making the model a second source of truth. The assistant **reads** inventory and policy through existing APIs (and future tool endpoints), **proposes** structured actions, and **applies changes** only through the same paths as human operators—with **audit**, **RBAC**, and—for **any destructive operation**—a **mandatory preview and explicit user permission** (§0) before execution.

---

## 2. Goals

| Goal | User-visible outcome |
|------|----------------------|
| **Throughput** | Faster path from natural-language intent to validated API payloads, bulk mappings, and runbooks. |
| **Trust** | Answers cite inventory objects and links; “unknown” is explicit when data is missing. |
| **Safety** | No silent database writes; **destructive actions always show a preview and require explicit confirmation** before apply (§0). |
| **Operability** | Observable, rate-limited, tenant-scoped usage suitable for production NetOps/DCIM teams. |

---

## 3. Non-goals (initial phases)

- Replacing deterministic policy engines, validation rules, or compliance checks with model judgment.
- **Unrestricted** autonomous remediation in production (no “fix it” without preview + permission for destructive work, per §0).
- Training a bespoke foundation model; **inference via hosted or self-hosted APIs** is assumed unless a later phase requires otherwise.
- Storing full customer topologies in an external vector DB **without** explicit product decision on data residency and retention (see §8).

---

## 4. Personas and primary scenarios

| Persona | Scenario | Assistant role |
|---------|----------|------------------|
| **NetOps / NOC** | “What depends on this device?” / incident context | Retrieve related objects via search + resource graph; summarize with citations. |
| **DCIM / field** | Plan a rack or maintenance window | Draft a **change bundle**; user reviews **preview**, then **confirms** before any destructive apply. |
| **Automation engineer** | Encode a recurring procedure | Draft structured steps, variables, and guardrails for jobs/plugins (human edits). |
| **Data steward** | Reconcile vendor export to inventory | Propose mapping + **import preview**; **confirm** before bulk import runs (destructive if overwrite/replace). |
| **New operator** | Learn object model in context | Explain **this** record and links using retrieved fields, not generic DCIM lecture. |

---

## 5. Functional requirements

### 5.1 Grounded Q&A (read path)

- Accept user questions with optional **page context** (current `resourceType`, `id`, route).
- Retrieve evidence using server-side tools: at minimum **`GET /v1/search`**, **`GET /v1/resource-view/{resourceType}/{id}`**, **`GET /v1/resource-graph/{resourceType}/{id}`** (see [platform README](../platform/README.md)).
- Respond with **short answer + citations** (object type, id, display fields, deep link path pattern).
- If evidence is insufficient, say so and suggest **specific** follow-up queries or UI navigation—not invented IDs.

### 5.2 Change assistance (write path, proposal-first)

- From natural language or structured selection, produce a **machine-readable proposal**: list of operations (create/update/archive/delete), target ids, field deltas, and dependency notes.
- The UI **always** renders a **Change preview** (diff/table, affected object count, operation types) before any apply.
- **If the proposal is destructive** (§5.5): the user **must** review the preview and trigger an explicit **Approve / Apply** (or equivalent) action. Until then, **no** mutating API calls for that proposal.
- Execution uses **existing mutating APIs** (not direct SQL or hidden ORM bypass), only after consent when required (§0).
- Respect **RBAC**: proposals are generated with the **same user identity** as the session; attempted operations beyond permission fail at execution with clear errors.

### 5.3 Bulk import assistance

- Input: sample rows + target `resourceType` (or “infer” with confirmation).
- Output: suggested **CSV column mapping**, type coercion notes, row-level or aggregate **validation warnings**, and an **import preview** (e.g. first N rows resolved, counts of creates/updates/archives, overwrite scope).
- **Destructive imports** (e.g. replace semantics, mass update, delete/archive via import): **mandatory preview + explicit permission** before `POST /v1/bulk/{resourceType}/import/csv` (or JSON import). Non-destructive trial imports may still use preview-by-default for consistency.
- Optional: small batch **dry-run** using existing validation endpoints if/when exposed; dry-run results feed the same preview surface.

### 5.4 Incident / ticket assist (optional phase)

- Parse pasted ticket text; extract candidate hostnames, IPs, circuit ids; resolve via search; return **linked inventory summary** for triage. If this flow ever suggests mutations, **§0** applies.

### 5.5 Classification: destructive operations

The platform **must** treat at least the following as **destructive** (preview + explicit permission required before execution):

| Category | Examples (product terminology may vary) |
|----------|----------------------------------------|
| **Delete / remove** | Hard delete, permanent removal from inventory |
| **Archive / soft retire** | Operations that remove objects from active use or break dependencies |
| **Bulk overwrite** | Import or sync that **replaces** existing rows, clears fields, or applies “full replace” semantics |
| **Destructive bulk** | Mass archive/delete, or imports above a configured row threshold without dry-run approval |
| **Irreversible automation** | Job or plugin execution that the policy engine classifies as destructive (if/when integrated) |

**Product rule:** When in doubt, classify as destructive and require preview + consent. **Creates** and **non-destructive updates** may still use the same preview UX for consistency, but **§0** is strictly required for rows in the table above.

---

## 6. System architecture

High-level placement: a **Copilot service** (or module inside the API boundary) sits behind the **API gateway / BFF**, calls the **LLM provider**, and invokes **tools** that wrap existing IntentCenter APIs. The **core domain** and **workers** remain authoritative for state changes. **Destructive mutations** pass through a **consent gate** the LLM cannot bypass.

```mermaid
flowchart LR
  subgraph clients["Clients"]
    WEB[Web console]
  end

  subgraph edge["Edge"]
    BFF[API / BFF]
    COP[Copilot orchestrator]
    GATE[Consent gate / apply token]
  end

  subgraph core["IntentCenter core"]
    API[REST v1]
    AUTH[AuthZ / RBAC]
    INV[Inventory services]
  end

  subgraph llm["External"]
    LLM[LLM API]
  end

  WEB --> BFF
  BFF --> API
  BFF --> COP
  COP --> LLM
  COP -->|read tools| API
  BFF --> GATE
  GATE -->|destructive apply only| API
  API --> AUTH
  AUTH --> INV
```

**Orchestration pattern:** the copilot runs a **tool-calling** loop: model requests tools → server executes **read** tools with user token → results returned to model → final user-facing message with citations. **Mutating tools** for destructive operations are **not** callable from the model path alone: the server returns a **preview payload** to the UI; only the user’s **Apply** action (with **consent token**, §0) may invoke the mutating API. **All tool calls are logged** (see §9).

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Web UI
  participant C as Copilot orchestrator
  participant L as LLM
  participant API as REST v1

  U->>UI: Ask for change / import
  UI->>C: Request with context
  C->>L: Prompt + read tool results
  L-->>C: Structured proposal
  C-->>UI: Preview payload (no destructive apply)
  UI->>U: Show preview + Confirm
  U->>UI: Approve apply
  UI->>API: Mutating request + consent token
  API-->>UI: Result / audit id
```

---

## 7. Tooling contract (server-side)

### 7.1 Read tools (model-invokable)

Minimum tool set for v1:

| Tool | Purpose | Backing API |
|------|---------|-------------|
| `search` | Find objects by query | `GET /v1/search?q=&limit=` |
| `get_resource_view` | Fields + graph payload for UI parity | `GET /v1/resource-view/{resourceType}/{id}` |
| `get_resource_graph` | Relationship JSON only | `GET /v1/resource-graph/{resourceType}/{id}` |

### 7.2 Write and destructive paths (not model-direct)

| Path | Behavior |
|------|----------|
| **Proposal generation** | Model or orchestrator outputs a **structured proposal**; **no** side effects on inventory. |
| **Destructive apply** | Invoked only from **client** (or server **apply** handler) after preview + consent token validation—not as a normal LLM tool. |
| **Optional `build_preview`** | Server-side helper that turns a proposal into canonical preview JSON for the UI; still no mutations. |

Future tools (as APIs exist or are added):

- Scoped **mutation preview** (dry-run) if the platform exposes it.
- **Policy explain**: deterministic output from policy engine, wrapped for the model to paraphrase.
- **Automation/job** template expansion for extension packages (draft only until user runs job with same preview/consent rules if destructive).

**Rules:**

- Tools execute **with the caller’s credentials** (no service-wide superuser for customer data).
- **The LLM must not** be given a tool that performs destructive mutations without the consent gate.
- **Idempotency keys** on mutating calls where the platform supports them.
- Hard **limits** on tool calls per user message and per session (cost and abuse control).

---

## 8. Security, privacy, and compliance

- **Data minimization:** send the LLM only fields needed for the task; optionally **redact** secrets (e.g. API keys, credentials) via server-side scrubbing before model calls.
- **Residency:** if using a third-party LLM, document **what leaves the boundary** (prompt, retrieved records, metadata). Offer **region pinning** and **enterprise VPC / private endpoint** options for regulated customers.
- **Retention:** configure whether prompts/responses are **not stored**, **stored encrypted with TTL**, or **opt-in** for quality review.
- **Prompt injection:** treat retrieved inventory text as **untrusted content**; system prompts instruct the model not to follow instructions embedded in records; strip or escape where feasible.
- **Audit:** log copilot sessions with `user_id`, `tenant`, tool names, object ids touched, **preview id / payload hash**, **consent granted** (timestamp + control surface), and **mutation outcome**. Destructive applies must be reconstructible for compliance reviews.

---

## 9. Observability

- Metrics: request latency, tokens in/out, tool error rate, rate-limit hits, user satisfaction feedback (optional thumbs).
- Tracing: one trace span per copilot request; child spans per tool call (align with product tracing strategy).
- Errors: surface user-safe messages; log provider errors server-side (no raw secrets).

---

## 10. UX surfaces (web)

Suggested placement (implementation detail can vary):

1. **Global assistant** entry in shell (sidebar or header)—always available; prefers **current page context** when open from an object view.
2. **Contextual actions** on list/detail pages: “Explain links,” “Draft update from description,” “Map import columns.”
3. **Change preview (mandatory for destructive work):** a dedicated panel or modal showing **what will happen** (object list, operation per row, before/after or field deltas, import row counts and modes). **Primary action** is **Review**; **Apply** / **Run import** is secondary and only enabled after the user has seen the preview (no one-click destructive apply from chat).
4. **Explicit permission:** checkbox or typed confirmation for **high-impact** classes (configurable), e.g. “Type DELETE to confirm” or “I understand N objects will be archived.”
5. **Post-apply:** link to audit trail / object history; clear success or partial-failure summary.

**Empty and error states:** offline provider, rate limit, or permission denial must be clear and actionable. If the user closes the preview without applying, **no** destructive call occurs.

---

## 11. Phased delivery

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **P0** | Grounded Q&A with `search` + `resource-view` / `resource-graph`; citations; no writes | Pilot users answer real questions with acceptable hallucination rate (measured by spot checks). |
| **P1** | Change **proposals** + **mandatory preview + consent** for destructive ops; execute via existing REST with full RBAC + apply token | Users can complete a destructive workflow only via preview → confirm; integration tests prove no apply without token. |
| **P2** | Bulk import mapping assistant + **same preview/consent** for destructive imports | Destructive imports cannot run without preview panel + confirmation. |
| **P3** | Ticket paste + correlation; optional policy/risk narration | Agreed triage workflow adopted by one team. |

---

## 12. Success metrics

- **Time to answer** for common inventory questions vs. manual navigation (sample tasks).
- **Proposal acceptance rate:** % of LLM-drafted bundles executed without major edit.
- **Import mapping:** edits required before successful bulk import (median).
- **Safety:** zero **unauthorized** or **un-previewed destructive** mutations attributable to copilot (must remain zero by design: consent gate + tests); incidents reviewed within SLA.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Hallucinated IDs or relationships | Citations required; tool-only facts for claims about specific objects; refuse when retrieval is empty. |
| Prompt injection via field values | Untrusted content handling; minimal exfiltration surface; avoid over-privileged tools. |
| User misled into approving a harmful change | Preview shows **server-built** canonical payload (hash-bound consent token), not model-authored “trust me” text; optional typed confirm for high-impact operations (§10). |
| Cost spikes | Per-user and global budgets; caching of embeddings if RAG added later; summarization of large graphs before model. |
| Regulatory pushback on cloud LLM | Private deployment option; data processing agreement; clear data flow doc. |

---

## 14. Open questions

1. **Embeddings / RAG:** Is semantic search over **docs + help** only, or also over **object embeddings**? The latter implies embedding pipelines, refresh on change, and storage strategy.
2. **Multi-tenant isolation:** Single copilot deployment with strict tenant context vs. per-tenant instances for large customers.
3. **Approval workflow:** Integrate with ITSM/change tickets for certain mutation types (platform roadmap dependency). **In-product** preview + permission (§0) remains mandatory; external approval may **add** a gate, not replace it unless policy explicitly allows.
4. **Languages:** English-only v1 vs. internationalization requirements for operator prompts and UI.

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-04-20 | Initial draft |
| 2026-04-20 | Mandatory preview + explicit permission for destructive operations; consent gate, §5.5 classification, tooling/UX/architecture updates |
