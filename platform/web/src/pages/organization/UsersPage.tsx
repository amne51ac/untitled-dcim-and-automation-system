import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiJson } from "../../api/client";
import { DataTable } from "../../components/DataTable";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { InlineLoader } from "../../components/Loader";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  authProvider: string;
  updatedAt: string | null;
};

const ROLES = ["READ", "WRITE", "ADMIN"] as const;

export function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["users", search],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set("limit", "100");
      if (search.trim()) p.set("q", search.trim());
      return apiJson<{ items: UserRow[]; nextOffset: number | null }>(`/v1/users?${p.toString()}`);
    },
  });

  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<(typeof ROLES)[number]>("READ");
  const [newPw, setNewPw] = useState("");

  const createUser = useMutation({
    mutationFn: (body: { email: string; displayName?: string; role: string; password?: string }) =>
      apiJson("/v1/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setCreating(false);
      setNewEmail("");
      setNewName("");
      setNewRole("READ");
      setNewPw("");
    },
  });

  const patchUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { displayName?: string; role?: string; isActive?: boolean } }) =>
      apiJson(`/v1/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <>
      <ModelListPageHeader
        title="Users"
        subtitle="People in your organization (administrators only)"
        showPin={false}
        showBulkTools={false}
        extraActions={
          creating ? null : (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Add user
            </button>
          )
        }
      />
      <div className="main-body">
        {creating ? (
          <div className="panel" style={{ maxWidth: "28rem", marginBottom: "1.25rem" }}>
            <h3 className="h3" style={{ marginTop: 0 }}>
              New user
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const body: { email: string; displayName?: string; role: string; password?: string } = {
                  email: newEmail.trim(),
                  role: newRole,
                };
                if (newName.trim()) body.displayName = newName.trim();
                if (newPw.trim()) body.password = newPw;
                if (newRole === "ADMIN" && !newPw.trim()) {
                  return;
                }
                createUser.mutate(body);
              }}
            >
              <label className="muted" htmlFor="nu-email">
                Email
              </label>
              <input
                id="nu-email"
                className="input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
              />
              <label className="muted" htmlFor="nu-name">
                Display name
              </label>
              <input
                id="nu-name"
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
              />
              <label className="muted" htmlFor="nu-role">
                Role
              </label>
              <select
                id="nu-role"
                className="input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as (typeof ROLES)[number])}
                style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <label className="muted" htmlFor="nu-pw">
                Initial password {newRole === "ADMIN" ? "(required for admin)" : "(optional)"}
              </label>
              <input
                id="nu-pw"
                className="input"
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.35rem", marginBottom: "0.75rem" }}
              />
              {createUser.error ? <div className="error-banner">{String(createUser.error)}</div> : null}
              <button type="submit" className="btn btn-primary" disabled={createUser.isPending || (newRole === "ADMIN" && newPw.length < 8)}>
                {createUser.isPending ? "Creating…" : "Create user"}
              </button>{" "}
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </form>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <input
            className="input"
            placeholder="Search by email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(q);
            }}
            style={{ maxWidth: "18rem" }}
          />
          <button type="button" className="btn btn-ghost" onClick={() => setSearch(q)}>
            Search
          </button>
        </div>

        {list.isLoading ? <InlineLoader /> : null}
        {list.error ? <div className="error-banner">{String(list.error)}</div> : null}
        {list.data ? (
          <DataTable
            columns={[
              { key: "email", label: "Email" },
              { key: "displayName", label: "Name" },
              { key: "role", label: "Role" },
              { key: "status", label: "Status" },
              { key: "auth", label: "Auth" },
              { key: "updated", label: "Updated" },
            ]}
            rows={list.data.items.map((r) => ({
              _id: r.id,
              _raw: r,
              email: r.email,
              displayName: r.displayName ?? "—",
              role: r.role,
              status: r.isActive ? "active" : "inactive",
              auth: r.authProvider,
              updated: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—",
            }))}
            actionsColumn={{
              label: "",
              render: (row) => {
                const r = (row as { _raw: UserRow })._raw;
                return (
                  <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                    <UserEditForm row={r} onSave={(body) => patchUser.mutate({ id: r.id, body })} pending={patchUser.isPending} />
                    {r.isActive ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          if (window.confirm(`Deactivate ${r.email}?`)) {
                            patchUser.mutate({ id: r.id, body: { isActive: false } });
                          }
                        }}
                        disabled={patchUser.isPending}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => patchUser.mutate({ id: r.id, body: { isActive: true } })}
                        disabled={patchUser.isPending}
                      >
                        Reactivate
                      </button>
                    )}
                  </span>
                );
              },
            }}
          />
        ) : null}
        {patchUser.isError ? <div className="error-banner" style={{ marginTop: "0.75rem" }}>{String(patchUser.error)}</div> : null}
      </div>
    </>
  );
}

function UserEditForm({
  row,
  onSave,
  pending,
}: {
  row: UserRow;
  onSave: (body: { displayName?: string; role?: string }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row.displayName ?? "");
  const [role, setRole] = useState(row.role);
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  }
  const displayDirty = (name.trim() || "") !== (row.displayName ?? "").trim() || role !== row.role;
  return (
    <form
      style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!displayDirty) return;
        onSave({ displayName: name.trim() || undefined, role: role !== row.role ? role : undefined });
        setOpen(false);
      }}
    >
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "8rem" }} />
      <select className="input" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "5.5rem" }}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || !displayDirty}
        title={!displayDirty ? "No changes to save" : undefined}
      >
        Save
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
