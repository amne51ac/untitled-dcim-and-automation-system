# Administration panel UI conventions

These rules apply to settings and configuration under **Administration** (`/platform/admin/*`).

## 1. Save changes

- **Save** (or **Create** for new resources) must be **disabled** when there is nothing new to persist.
- Compare the form to the last loaded server state (or to the empty “new record” baseline) and treat the button as “dirty” only when that comparison differs.
- The button’s `title` should explain why it is disabled (for example, “No changes to save”).
- The submit handler should no-op if somehow invoked while unchanged.

**Implemented today:** LLM & Copilot, Sign-in & identity, the connector editor on Plugins & extensions, and the inline user row editor on User management.

## 2. Test connection

- Any flow that configures an **outbound or directory connection** should offer an explicit **Test connection** (or equivalent) that validates current or draft values **without** saving.
- **LLM & Copilot:** `POST /v1/admin/llm/test` — minimal `chat/completions` call using effective settings merged with optional form fields (respects `LLM_*` env locks the same way as the save path).
- **Sign-in & identity:** `POST /v1/admin/identity/test` with `target: "ldap" | "azure_ad" | "oidc"` and optional `overrides` (same key names as the identity PATCH for that provider). LDAP performs a bind; Entra and OIDC fetch OpenID well-known metadata.
- **Connectors (Plugins & extensions):** `POST /v1/connectors/test` with either `connectorId` (optional `settings` / `credentials` to test unsaved JSON) or a draft `type` + `settings` (+ optional `credentials`) for a not-yet-created row. Uses the same HTTP probe as `connector.sync` without updating stored health fields.

## 3. Grouping form fields

- **Major** blocks use the existing `panel` class (title `h3` + short description + fields).
- **Subsections** within one screen (e.g. connector name vs. URL/credentials) use `admin-form-section` in `global.css` so the purpose of each block is clear without duplicating a full `panel` around it.
- Prefer a short heading and one line of muted description before the fields in each group.

When adding a new admin settings page, follow the same three patterns so behavior stays consistent.
