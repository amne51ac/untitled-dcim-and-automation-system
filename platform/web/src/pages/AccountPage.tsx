import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson, logout } from "../api/client";
import { ModelListPageHeader } from "../components/ModelListPageHeader";
import { InlineLoader } from "../components/Loader";

type Me = {
  organization: { name: string; slug: string };
  preferences: Record<string, unknown>;
  auth: {
    mode: "user";
    user: {
      id: string;
      email: string;
      displayName: string | null;
      role: string;
      authProvider: string;
      isActive?: boolean;
    };
  };
};

export function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiJson<Me>("/v1/me"),
  });

  const u = me.data?.auth.mode === "user" ? me.data.auth.user : null;
  const [displayName, setDisplayName] = useState("");
  const [dnDirty, setDnDirty] = useState(false);

  useEffect(() => {
    if (u && !dnDirty) {
      setDisplayName(u.displayName ?? "");
    }
  }, [u, dnDirty]);

  const patchMe = useMutation({
    mutationFn: (body: { displayName?: string; preferences?: Record<string, unknown> }) =>
      apiJson("/v1/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      setDnDirty(false);
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const changePassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiJson("/v1/me/password", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
    },
  });

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const isLocal = u?.authProvider?.toUpperCase() === "LOCAL";

  async function onSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!u) return;
    setDnDirty(true);
    await patchMe.mutateAsync({ displayName: displayName.trim() || undefined });
  }

  function onChangeDn(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value);
    setDnDirty(true);
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== newPw2) return;
    await changePassword.mutateAsync({ currentPassword: currentPw, newPassword: newPw });
  }

  return (
    <>
      <ModelListPageHeader
        title="Account"
        subtitle="Profile, password, and preferences for your session"
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        {me.isLoading ? <InlineLoader /> : null}
        {me.error ? <div className="error-banner">{String(me.error)}</div> : null}
        {u ? (
          <div className="account-sections" style={{ maxWidth: "32rem" }}>
            <section className="panel" style={{ marginBottom: "1.25rem" }}>
              <h3 className="h3" style={{ marginTop: 0 }}>
                Profile
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Organization: <strong>{me.data?.organization.name}</strong> ({me.data?.organization.slug})
              </p>
              <p className="muted">
                Email: <strong>{u.email}</strong> (read-only)
              </p>
              <p className="muted">
                Role: <strong>{u.role}</strong>
              </p>
              <form onSubmit={onSaveDisplayName} style={{ marginTop: "1rem" }}>
                <label className="muted" htmlFor="displayName">
                  Display name
                </label>
                <input
                  id="displayName"
                  className="input"
                  value={displayName}
                  onChange={onChangeDn}
                  style={{ display: "block", marginTop: "0.35rem", width: "100%" }}
                />
                <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem" }} disabled={patchMe.isPending}>
                  {patchMe.isPending ? "Saving…" : "Save display name"}
                </button>
                {patchMe.isError ? <div className="error-banner" style={{ marginTop: "0.75rem" }}>{String(patchMe.error)}</div> : null}
              </form>
            </section>

            {isLocal ? (
              <section className="panel" style={{ marginBottom: "1.25rem" }}>
                <h3 className="h3" style={{ marginTop: 0 }}>
                  Change password
                </h3>
                <form onSubmit={onPasswordSubmit}>
                  <label className="muted" htmlFor="cur-pw">
                    Current password
                  </label>
                  <input
                    id="cur-pw"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    style={{ display: "block", marginTop: "0.35rem", width: "100%", marginBottom: "0.75rem" }}
                  />
                  <label className="muted" htmlFor="new-pw">
                    New password (8+ characters)
                  </label>
                  <input
                    id="new-pw"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    style={{ display: "block", marginTop: "0.35rem", width: "100%", marginBottom: "0.75rem" }}
                  />
                  <label className="muted" htmlFor="new-pw2">
                    Confirm new password
                  </label>
                  <input
                    id="new-pw2"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={newPw2}
                    onChange={(e) => setNewPw2(e.target.value)}
                    style={{ display: "block", marginTop: "0.35rem", width: "100%", marginBottom: "0.75rem" }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={changePassword.isPending || newPw.length < 8 || newPw !== newPw2}
                  >
                    {changePassword.isPending ? "Updating…" : "Update password"}
                  </button>
                  {changePassword.isError ? <div className="error-banner" style={{ marginTop: "0.75rem" }}>{String(changePassword.error)}</div> : null}
                  {changePassword.isSuccess && !changePassword.isPending && !changePassword.isError ? (
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      Password updated.
                    </p>
                  ) : null}
                </form>
              </section>
            ) : (
              <section className="panel muted" style={{ marginBottom: "1.25rem" }}>
                <p style={{ margin: 0 }}>Password change is not available for SSO accounts ({u.authProvider}).</p>
              </section>
            )}

            <section className="panel">
              <h3 className="h3" style={{ marginTop: 0 }}>
                Pinned pages
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Use the <strong>⋯</strong> menu in page headers to pin or unpin list views. Pinned pages appear in the
                sidebar.
              </p>
            </section>

            <p style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  await logout();
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </button>
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
