import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, apiJson } from "../../api/client";
import { BlockLoader, InlineLoader } from "../../components/Loader";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { PAGE_IDS } from "../../extensibility/pageIds";

const CONNECTOR_TYPES = ["http_get", "webhook_outbound", "generic_rest", "http_poll"] as const;

const DEFAULT_SETTINGS = '{\n  "url": "https://example.com"\n}';

type PluginRow = {
  id: string;
  packageName: string;
  version: string;
  enabled: boolean;
  contributions?: { summary?: { widgetCount?: number } };
};

type PlacementRow = {
  id: string;
  packageName?: string;
  pageId: string;
  slot: string;
  widgetKey: string;
  enabled: boolean;
  priority: number;
};

type ConnectorListItem = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  pluginRegistrationId?: string | null;
  packageName?: string | null;
  settings?: Record<string, unknown>;
  hasCredentials?: boolean;
  healthStatus?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

type ConnectorDetail = ConnectorListItem & {
  credentials?: Record<string, unknown> | null;
};

function emptyConnectorForm() {
  return {
    name: "",
    type: "http_get" as string,
    pluginId: "",
    enabled: true,
    settingsText: DEFAULT_SETTINGS,
    credentialsText: "",
  };
}

export function PluginExtensionsPage() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingConn, setDeletingConn] = useState<string | null>(null);
  const [form, setForm] = useState<{
    pluginId: string;
    pageId: string;
    slot: string;
    widgetKey: string;
    priority: number;
  }>({
    pluginId: "",
    pageId: PAGE_IDS.inventoryObjectView,
    slot: "content.aside",
    widgetKey: "builtin.objectContext",
    priority: 0,
  });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [connForm, setConnForm] = useState(emptyConnectorForm);
  const [connErr, setConnErr] = useState<string | null>(null);
  const [connSaving, setConnSaving] = useState(false);
  const [connDetailLoading, setConnDetailLoading] = useState(false);

  const plugins = useQuery({
    queryKey: ["plugins"],
    queryFn: () => apiJson<{ items: PluginRow[] }>("/v1/plugins"),
  });

  const placements = useQuery({
    queryKey: ["admin", "plugin-placements"],
    queryFn: () => apiJson<{ items: PlacementRow[] }>("/v1/admin/plugin-placements?includeDisabled=true"),
  });

  const connectors = useQuery({
    queryKey: ["connectors"],
    queryFn: () => apiJson<{ items: ConnectorListItem[] }>("/v1/connectors"),
  });

  const loadConnectorForEdit = useCallback(async (id: string) => {
    setConnErr(null);
    setConnDetailLoading(true);
    setEditingConnectorId(id);
    try {
      const res = await apiJson<{ item: ConnectorDetail }>(`/v1/connectors/${encodeURIComponent(id)}`);
      const it = res.item;
      setConnForm({
        name: it.name,
        type: it.type,
        pluginId: it.pluginRegistrationId ?? "",
        enabled: it.enabled,
        settingsText: JSON.stringify(it.settings && typeof it.settings === "object" ? it.settings : {}, null, 2),
        credentialsText:
          it.credentials && typeof it.credentials === "object" ? JSON.stringify(it.credentials, null, 2) : "",
      });
    } catch (e) {
      setConnErr(e instanceof Error ? e.message : String(e));
      setEditingConnectorId(null);
    } finally {
      setConnDetailLoading(false);
    }
  }, []);

  function startNewConnector() {
    setEditingConnectorId("new");
    setConnForm(emptyConnectorForm());
    setConnErr(null);
  }

  function cancelConnectorForm() {
    setEditingConnectorId(null);
    setConnForm(emptyConnectorForm());
    setConnErr(null);
  }

  function parseJsonField(raw: string, label: string): Record<string, unknown> {
    const t = raw.trim();
    if (!t) return {};
    try {
      const v = JSON.parse(t) as unknown;
      if (v === null || typeof v !== "object" || Array.isArray(v)) {
        throw new Error(`${label} must be a JSON object`);
      }
      return v as Record<string, unknown>;
    } catch (e) {
      throw new Error(e instanceof Error && e.message.startsWith(label) ? e.message : `${label}: invalid JSON`);
    }
  }

  async function onSaveConnector(e: FormEvent) {
    e.preventDefault();
    setConnErr(null);
    let settings: Record<string, unknown>;
    let credentials: Record<string, unknown> | null = null;
    try {
      settings = parseJsonField(connForm.settingsText, "Settings");
    } catch (err) {
      setConnErr(err instanceof Error ? err.message : String(err));
      return;
    }
    try {
      if (connForm.credentialsText.trim()) {
        credentials = parseJsonField(connForm.credentialsText, "Credentials");
      } else {
        credentials = null;
      }
    } catch (err) {
      setConnErr(err instanceof Error ? err.message : String(err));
      return;
    }

    if (!connForm.name.trim()) {
      setConnErr("Name is required.");
      return;
    }
    if (!connForm.type.trim()) {
      setConnErr("Type is required.");
      return;
    }

    setConnSaving(true);
    try {
      if (editingConnectorId && editingConnectorId !== "new") {
        const body: Record<string, unknown> = {
          name: connForm.name.trim(),
          type: connForm.type.trim(),
          enabled: connForm.enabled,
          settings,
        };
        if (connForm.pluginId) {
          body.pluginRegistrationId = connForm.pluginId;
        }
        if (credentials !== null) {
          body.credentials = credentials;
        }
        await apiJson(`/v1/connectors/${encodeURIComponent(editingConnectorId)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiJson("/v1/connectors", {
          method: "POST",
          body: JSON.stringify({
            name: connForm.name.trim(),
            type: connForm.type.trim(),
            enabled: connForm.enabled,
            settings,
            pluginRegistrationId: connForm.pluginId || null,
            credentials: credentials && Object.keys(credentials).length > 0 ? credentials : null,
          }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["connectors"] });
      cancelConnectorForm();
    } catch (x) {
      setConnErr(x instanceof Error ? x.message : String(x));
    } finally {
      setConnSaving(false);
    }
  }

  async function onDeleteConn(id: string) {
    if (!window.confirm("Delete this connector? This cannot be undone.")) return;
    setDeletingConn(id);
    setConnErr(null);
    try {
      await apiFetch(`/v1/connectors/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (editingConnectorId === id) {
        cancelConnectorForm();
      }
      await qc.invalidateQueries({ queryKey: ["connectors"] });
    } catch (x) {
      setConnErr(x instanceof Error ? x.message : String(x));
    } finally {
      setDeletingConn(null);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.pluginId.trim()) {
      setFormErr("Select a plugin.");
      return;
    }
    setFormErr(null);
    setSaving(true);
    try {
      await apiJson("/v1/admin/plugin-placements", {
        method: "POST",
        body: JSON.stringify({
          pluginRegistrationId: form.pluginId,
          pageId: form.pageId,
          slot: form.slot,
          widgetKey: form.widgetKey,
          priority: form.priority,
          enabled: true,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["admin", "plugin-placements"] });
    } catch (x) {
      setFormErr(x instanceof Error ? x.message : String(x));
    } finally {
      setSaving(false);
    }
  }

  async function onDeletePl(id: string) {
    if (!window.confirm("Remove this widget placement?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/v1/admin/plugin-placements/${encodeURIComponent(id)}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["admin", "plugin-placements"] });
    } finally {
      setDeleting(null);
    }
  }

  if (plugins.isLoading) {
    return <BlockLoader label="Loading…" />;
  }
  if (plugins.error) {
    return <div className="error-banner">{String(plugins.error)}</div>;
  }

  return (
    <>
      <ModelListPageHeader
        title="Plugins & extensions"
        subtitle="Registered packages, UI slot placements, and connectors for this organization."
        showPin={false}
        showBulkTools={false}
        extraActions={
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
            <Link to="/platform/jobs" className="btn btn-ghost">
              Jobs
            </Link>
            <Link to="/platform/job-runs" className="btn btn-ghost">
              Job runs
            </Link>
          </div>
        }
      />
      <div className="main-body plugin-extensions-page">
        <div className="page-lede plugin-extensions-lede">
          <p>
            <strong>Connectors:</strong> run job <code className="mono">connector.sync</code> with{" "}
            <code className="mono">{`{ "connectorId": "<uuid>" }`}</code> in the run input. Types{" "}
            <code className="mono">webhook_outbound</code> and <code className="mono">http_get</code> perform outbound
            HTTP from the API process (use a worker in production for isolation).
          </p>
        </div>

        <section className="graph-section" aria-labelledby="ext-plugins-h">
          <h3 id="ext-plugins-h" className="graph-section-title">
            Registered plugins
          </h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Version</th>
                  <th>Widgets (manifest)</th>
                </tr>
              </thead>
              <tbody>
                {(plugins.data?.items ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.packageName}</td>
                    <td>{p.version}</td>
                    <td>{p.contributions?.summary?.widgetCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="graph-section" aria-labelledby="ext-placements-h">
          <h3 id="ext-placements-h" className="graph-section-title">
            UI placements
          </h3>
          {placements.isLoading ? <InlineLoader label="Loading…" /> : null}
          {placements.error ? <div className="error-banner">{String(placements.error)}</div> : null}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Slot</th>
                  <th>Widget</th>
                  <th>Plugin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(placements.data?.items ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: "0.82em" }}>
                      {r.pageId}
                    </td>
                    <td className="mono" style={{ fontSize: "0.82em" }}>
                      {r.slot}
                    </td>
                    <td className="mono" style={{ fontSize: "0.82em" }}>
                      {r.widgetKey}
                    </td>
                    <td className="mono" style={{ fontSize: "0.82em" }}>
                      {r.packageName ?? "—"}
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn-ghost table-inline-link"
                        onClick={() => onDeletePl(r.id)}
                        disabled={deleting === r.id}
                      >
                        {deleting === r.id ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="graph-section" aria-labelledby="ext-add-h">
          <h3 id="ext-add-h" className="graph-section-title">
            Add placement
          </h3>
          <div className="plugin-extensions-form-panel">
            <form onSubmit={onAdd}>
              {formErr ? <div className="error-banner" style={{ marginBottom: "0.75rem" }}>{formErr}</div> : null}
              <div style={{ marginBottom: "0.85rem" }}>
                <label className="muted" htmlFor="pe-plugin">
                  Plugin
                </label>
                <select
                  id="pe-plugin"
                  className="input"
                  value={form.pluginId}
                  onChange={(e) => setForm((f) => ({ ...f, pluginId: e.target.value }))}
                  required
                  style={{ display: "block", width: "100%", maxWidth: "28rem", marginTop: "0.35rem" }}
                >
                  <option value="">—</option>
                  {(plugins.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.packageName} ({p.version})
                    </option>
                  ))}
                </select>
              </div>
              <div className="plugin-extensions-form-grid">
                <div>
                  <label className="muted" htmlFor="pe-page">
                    Page ID
                  </label>
                  <input
                    id="pe-page"
                    className="input"
                    value={form.pageId}
                    onChange={(e) => setForm((f) => ({ ...f, pageId: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                  />
                </div>
                <div>
                  <label className="muted" htmlFor="pe-slot">
                    Slot
                  </label>
                  <input
                    id="pe-slot"
                    className="input"
                    value={form.slot}
                    onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                  />
                </div>
                <div>
                  <label className="muted" htmlFor="pe-wkey">
                    Widget key
                  </label>
                  <input
                    id="pe-wkey"
                    className="input"
                    value={form.widgetKey}
                    onChange={(e) => setForm((f) => ({ ...f, widgetKey: e.target.value }))}
                    style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                  />
                </div>
                <div style={{ maxWidth: "7rem" }}>
                  <label className="muted" htmlFor="pe-pri">
                    Priority
                  </label>
                  <input
                    id="pe-pri"
                    type="number"
                    className="input"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
                    style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: "0.9rem" }}>
                {saving ? "…" : "Add placement"}
              </button>
            </form>
          </div>
        </section>

        <section className="graph-section" aria-labelledby="ext-conn-h">
          <h3 id="ext-conn-h" className="graph-section-title">
            Connectors
          </h3>
          <p className="page-lede" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Create and edit outbound integration endpoints. <code className="mono">settings</code> must include{" "}
            <code className="mono">url</code> for <code className="mono">http_get</code> and{" "}
            <code className="mono">webhook_outbound</code>. Credentials are stored server-side and only sent over TLS to
            this app.
          </p>

          <div style={{ marginBottom: "0.9rem" }}>
            <button type="button" className="btn btn-primary" onClick={startNewConnector} disabled={editingConnectorId === "new"}>
              New connector
            </button>
          </div>

          {connectors.isLoading ? <InlineLoader label="Loading…" /> : null}
          {connectors.error ? <div className="error-banner">{String(connectors.error)}</div> : null}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Enabled</th>
                  <th>Plugin</th>
                  <th>Health</th>
                  <th>Id</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(connectors.data?.items ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: "0.86em" }}>
                      {c.name}
                    </td>
                    <td>{c.type}</td>
                    <td>{c.enabled ? "yes" : "no"}</td>
                    <td className="mono" style={{ fontSize: "0.8em" }}>
                      {c.packageName ?? "—"}
                    </td>
                    <td style={{ maxWidth: "6rem" }} title={c.lastError ?? ""}>
                      {c.healthStatus ?? "—"}
                    </td>
                    <td
                      className="mono"
                      style={{ fontSize: "0.72em", maxWidth: "8rem", overflow: "hidden", textOverflow: "ellipsis" }}
                      title={c.id}
                    >
                      {c.id}
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn-ghost table-inline-link"
                        onClick={() => void loadConnectorForEdit(c.id)}
                        disabled={connDetailLoading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost table-inline-link"
                        onClick={() => onDeleteConn(c.id)}
                        disabled={deletingConn === c.id}
                        style={{ color: "var(--danger)" }}
                      >
                        {deletingConn === c.id ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingConnectorId ? (
            <div className="plugin-extensions-form-panel" style={{ marginTop: "1.1rem" }}>
              <h4 className="graph-section-title" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                {editingConnectorId === "new" ? "New connector" : "Edit connector"}
              </h4>
              {connErr ? <div className="error-banner" style={{ marginBottom: "0.75rem" }}>{connErr}</div> : null}
              {connDetailLoading ? <InlineLoader label="Loading connector…" /> : null}
              {!connDetailLoading ? (
                <form onSubmit={onSaveConnector}>
                  <div className="plugin-extensions-form-grid">
                    <div>
                      <label className="muted" htmlFor="cc-name">
                        Name
                      </label>
                      <input
                        id="cc-name"
                        className="input"
                        value={connForm.name}
                        onChange={(e) => setConnForm((f) => ({ ...f, name: e.target.value }))}
                        required
                        style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                      />
                    </div>
                    <div>
                      <label className="muted" htmlFor="cc-type">
                        Type
                      </label>
                      <input
                        id="cc-type"
                        className="input"
                        value={connForm.type}
                        onChange={(e) => setConnForm((f) => ({ ...f, type: e.target.value }))}
                        list="cc-type-list"
                        required
                        style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                      />
                      <datalist id="cc-type-list">
                        {CONNECTOR_TYPES.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="muted" htmlFor="cc-plugin">
                        Plugin (optional)
                      </label>
                      <select
                        id="cc-plugin"
                        className="input"
                        value={connForm.pluginId}
                        onChange={(e) => setConnForm((f) => ({ ...f, pluginId: e.target.value }))}
                        style={{ display: "block", width: "100%", marginTop: "0.35rem" }}
                      >
                        <option value="">—</option>
                        {(plugins.data?.items ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.packageName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ alignSelf: "end", paddingBottom: "0.2rem" }}>
                      <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={connForm.enabled}
                          onChange={(e) => setConnForm((f) => ({ ...f, enabled: e.target.checked }))}
                        />
                        Enabled
                      </label>
                    </div>
                  </div>
                  <div style={{ marginTop: "0.85rem" }}>
                    <label className="muted" htmlFor="cc-settings">
                      Settings (JSON)
                    </label>
                    <textarea
                      id="cc-settings"
                      className="input"
                      value={connForm.settingsText}
                      onChange={(e) => setConnForm((f) => ({ ...f, settingsText: e.target.value }))}
                      rows={6}
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: "40rem",
                        marginTop: "0.35rem",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <label className="muted" htmlFor="cc-cred">
                      Credentials (JSON, optional)
                    </label>
                    <p className="muted" style={{ fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
                      On edit, leave empty to keep existing stored credentials. Enter <code className="mono">{"{}"}</code> to
                      clear.
                    </p>
                    <textarea
                      id="cc-cred"
                      className="input"
                      value={connForm.credentialsText}
                      onChange={(e) => setConnForm((f) => ({ ...f, credentialsText: e.target.value }))}
                      rows={4}
                      placeholder="{}"
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: "40rem",
                        marginTop: "0.35rem",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.9rem" }}>
                    <button className="btn btn-primary" type="submit" disabled={connSaving}>
                      {connSaving ? "…" : editingConnectorId !== "new" ? "Save changes" : "Create connector"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelConnectorForm} disabled={connSaving}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
