import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiJson } from "../../api/client";
import { DataTable } from "../../components/DataTable";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { InlineLoader } from "../../components/Loader";

type TokenRow = {
  id: string;
  name: string;
  role: string;
  createdAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

const ROLES = ["READ", "WRITE", "ADMIN"] as const;

export function ApiTokensPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("WRITE");
  const [newToken, setNewToken] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => apiJson<{ items: TokenRow[] }>("/v1/tokens"),
  });

  const create = useMutation({
    mutationFn: (body: { name: string; role: string }) =>
      apiJson<{ id: string; name: string; role: string; token: string; message: string }>("/v1/tokens", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setNewToken(data.token);
      setName("");
      setRole("WRITE");
      void qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  return (
    <>
      <ModelListPageHeader
        title="API tokens"
        subtitle="Automation and integrations use Bearer tokens. The secret is shown only once when you create a token."
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        {newToken ? (
          <div className="error-banner" style={{ borderColor: "var(--accent-dim)", background: "rgba(232, 184, 78, 0.08)" }}>
            <strong>Copy this token now.</strong> It will not be shown again.{" "}
            <code className="mono" style={{ display: "block", marginTop: "0.5rem", wordBreak: "break-all" }}>
              {newToken}
            </code>
            <button type="button" className="btn btn-ghost" style={{ marginTop: "0.75rem" }} onClick={() => setNewToken(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="panel" style={{ maxWidth: "28rem", marginBottom: "1.25rem" }}>
          <h3 className="h3" style={{ marginTop: 0 }}>
            Create token
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              create.mutate({ name: name.trim(), role });
            }}
          >
            <label className="muted" htmlFor="tok-name">
              Name
            </label>
            <input
              id="tok-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CI, monitoring"
              required
              style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
            />
            <label className="muted" htmlFor="tok-role">
              Role
            </label>
            <select
              id="tok-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
              style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {create.error ? <div className="error-banner">{String(create.error)}</div> : null}
            <button type="submit" className="btn btn-primary" disabled={create.isPending || !name.trim()}>
              {create.isPending ? "Creating…" : "Create token"}
            </button>
          </form>
        </div>

        {list.isLoading ? <InlineLoader /> : null}
        {list.error ? <div className="error-banner">{String(list.error)}</div> : null}
        {list.data ? (
          <DataTable
            columns={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "createdAt", label: "Created" },
              { key: "lastUsedAt", label: "Last used" },
            ]}
            emptyMessage="No API tokens yet. Create one for scripts and integrations."
            rows={list.data.items.map((t) => ({
              _id: t.id,
              name: t.name,
              role: t.role,
              createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : "—",
              lastUsedAt: t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "—",
            }))}
          />
        ) : null}
        <p className="muted" style={{ marginTop: "1rem" }}>
          Use the header <code className="mono">Authorization: Bearer &lt;token&gt;</code> (optional session cookie is used by this console only).
        </p>
      </div>
    </>
  );
}
