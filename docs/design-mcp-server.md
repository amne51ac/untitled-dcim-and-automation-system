# Design: Optional MCP server for external LLM clients (IntentCenter)

**Status:** Draft  
**Last updated:** 2026-04-29  
**Related:** [LLM-assisted operations](design-llm-assistant.md), [Platform README](../platform/README.md), [Architecture](architecture.md)

---

## 1. Summary

The platform may **optionally** expose a **Model Context Protocol (MCP)** endpoint so other LLM clients (Cursor, Claude Desktop, custom agents) can invoke **tools** that delegate to the **existing HTTP API**. Authentication reuses **API tokens** (`ApiToken` / `ApiTokenRole`) and the same **`Authorization: Bearer`** model as the REST API. **Token role** (READ vs WRITE vs ADMIN) regulates whether a client is offered **read-only** tools, **mutating** tools, or **admin** tools.

No new credential type is required for the first version.

---

## 2. Goals

| Goal | Outcome |
|------|---------|
| **Interoperability** | External LLMs can use the same operations as documented for `/v1/...` via MCP tools, without a bespoke client. |
| **Consistent access control** | **READ** / **WRITE** / **ADMIN** on API tokens map directly to which tools exist and which operations succeed. |
| **Single source of truth** | Business rules, validation, and permission checks live in **existing** routes or shared service code—MCP is a thin transport adapter. |
| **Safe default** | MCP is **disabled** by default; enabling it is an explicit operator choice. |

### Non-goals (initial version)

- Replacing the in-app assistant or its preview/consent flows for **destructive** work (see §8).
- A separate parallel authorization system or shadow database access.

---

## 3. Existing model (reused as-is)

The backend already:

- Resolves `Authorization: Bearer <raw>` to an `ApiToken` (hashed) with `organization`, `role`, and expiry. See `platform/backend/nims/deps.py` (`resolve_auth`).
- Enforces mutating routes with `require_write` and admin-only routes with `require_admin` in `platform/backend/nims/auth_context.py`.
- Defines `ApiTokenRole`: `READ`, `WRITE`, `ADMIN` (Prisma: `ApiToken` / `ApiTokenRole`).

MCP must **not** bypass these checks: tool implementations either call the same code paths the REST routers use or call internal helpers that those routers already use.

---

## 4. Transport and deployment

| Mode | When to use | Auth |
|------|-------------|------|
| **HTTP** (Streamable HTTP or SSE, per chosen MCP SDK/spec) on the API origin | Remote clients, production, clear per-request auth | **Per request:** `Authorization: Bearer <api_token>` |
| **stdio** (optional later) | Local desktop “MCP server” subprocess | Token from **environment** (e.g. one org per process), still the same token string |

**Recommended first step:** implement **HTTP MCP mounted on the FastAPI app** (e.g. `/mcp` or under `/v1/...`), behind the same process and config as the REST API. An optional **stdio** wrapper can proxy to `http://127.0.0.1:.../mcp` for local dev.

---

## 5. Configuration

- **Feature flag:** e.g. `NIMS_MCP_ENABLED` — default **`false`** so nothing is exposed accidentally.
- **Documentation:** how to create tokens (existing API Tokens / admin UI), and that **READ** vs **WRITE** tokens control automation scope.

If the deployment uses a reverse proxy, document path, TLS, and that MCP is intended for **trusted** networks or authenticated access unless additional controls are added (§7).

---

## 6. Authorization and tool surface

- **Standard for external LLMs:** `Authorization: Bearer <api_token>`. (Browser session cookies are secondary; Bearer should be the documented path for automation.)
- For each MCP session/request, build the same `AuthContext` the REST API uses.
- **`tools/list` is role-filtered** so a READ client does not see write tool names (defense in depth; the server must still reject unauthorized `tools/call`).

| Role | Tools (conceptual) |
|------|--------------------|
| **READ** | Tools that map to read-only or GET-style operations (e.g. search, resource view, resource graph, read GraphQL if exposed). |
| **WRITE** | Read tools **plus** tools that invoke mutating operations allowed by `require_write`. |
| **ADMIN** | **Plus** tools that require `require_admin` (aligned with existing admin-only routes, e.g. org-specific admin surfaces). |

**Naming:** use stable, namespaced tool names, e.g. `intentcenter.search`, `intentcenter.resource_view`—exact list should track OpenAPI/implementation.

---

## 7. Observability, limits, and hardening

- **Audit:** log tool name, organization id, API token id, success/failure, aligned with other API access logging.
- **Rate limiting:** per token or per organization (new or existing middleware).
- **Transport:** for internet-facing deployments, require **TLS**; treat WRITE tokens like powerful automation keys.

---

## 8. Relationship to `design-llm-assistant.md` (preview and destructive work)

`design-llm-assistant.md` requires **preview and explicit user permission** (and apply/consent tokens) for **destructive** changes in the in-app assistant. MCP consumers may be **fully automated**.

The product should **choose and document** one of these policies for MCP **write** exposure:

1. **Strict:** MCP write tools only expose “propose / preview” steps; **apply** requires a human- or system-controlled step with a signed **apply** artifact (aligns with assistant safety; more friction for headless clients).
2. **Pragmatic v1:** WRITE tokens may invoke the **same** mutating APIs as curl/scripts today; operators rely on **token scoping**, audit, and rate limits—**stricter gating** can be added when consent APIs exist for those flows.

Either way, **server-side** `require_write` / `require_admin` remain mandatory; MCP must not add a back door.

---

## 9. Implementation phases (suggested)

1. **Spike:** `NIMS_MCP_ENABLED`, HTTP MCP with Bearer auth, one read tool (e.g. search), contract tests.
2. **Read tools** aligned with the assistant’s documented read surface (search, resource view, resource graph, etc.).
3. **Write tools** (or proposal-only tools) calling shared router/service code; `tools/list` and `tools/call` both enforce role.
4. **Optional stdio** local proxy.
5. **Hardening:** rate limits, operator docs, security review of the exposed path set.

---

## 10. Risks and open decisions

- **MCP spec/SDK versions:** HTTP transport has evolved; pin the SDK and document the supported spec revision.
- **Avoid duplicated logic:** one internal “tool” or “capability” module used by both REST-oriented flows and MCP so permission rules do not fork.
- **User sessions for MCP:** if interactive users (not just API tokens) should use MCP, a follow-on design (short-lived tokens, OAuth) is required; v1 can remain **API-token–only** for simplicity and clarity.
- **Resources/prompts (optional):** a later phase can add MCP `resources`/`prompts` (e.g. policy snippets); not required for a minimal **tools** server.

---

## 11. References in repo

- Auth resolution: `platform/backend/nims/deps.py`
- Role gates: `platform/backend/nims/auth_context.py` (`require_write`, `require_admin`)
- Data model: `platform/prisma/schema.prisma` (`ApiToken`, `ApiTokenRole`)
