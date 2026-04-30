import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiJson } from "../../api/client";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { BlockLoader, InlineLoader } from "../../components/Loader";

const LOCK_MSG = "Settings configured at the environment level can not be changed within the interface";

type Field = {
  name: string;
  value: unknown;
  display: unknown;
  source: "environment" | "storage";
  locked: boolean;
  sensitive?: boolean;
  configured?: boolean;
};

type Group = { [k: string]: Field };

type ExternalIdp = "none" | "ldap" | "azure_ad" | "oidc";

type IdentityRes = {
  message: string;
  help: string;
  anyEnvironmentLock: boolean;
  local: Field;
  external: Field;
  ldap: Group;
  azure: Group;
  oidc: Group;
};

function roBlock(f: Field) {
  return (
    <p className="mono" style={{ margin: "0.35rem 0 0.75rem", color: "var(--muted-foreground, #8a8a9a)" }} title={LOCK_MSG}>
      {f.display != null && f.display !== "" ? String(f.display) : f.value != null ? String(f.value) : "—"}
    </p>
  );
}

function FieldInput({
  label,
  f,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  f: Field;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  if (f.locked) {
    return (
      <div style={{ marginBottom: "0.9rem" }}>
        <span className="muted">{label}</span>
        {roBlock(f)}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label className="muted" style={{ display: "block" }} htmlFor={`f-${f.name}`}>
        {label}
        {f.sensitive && f.configured ? <span className="muted" style={{ fontSize: "0.85em" }}> (leave blank to keep)</span> : null}
      </label>
      <input
        id={`f-${f.name}`}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        style={{ display: "block", width: "100%", maxWidth: "32rem", marginTop: "0.35rem" }}
      />
    </div>
  );
}

const LDAP: { key: keyof Group; label: string; secret: boolean }[] = [
  { key: "url", label: "URL", secret: false },
  { key: "bindDn", label: "Bind DN", secret: false },
  { key: "userSearchBase", label: "User search base", secret: false },
  { key: "userSearchFilter", label: "User search filter", secret: false },
  { key: "bindPassword", label: "Bind password", secret: true },
];

const AZ: { key: keyof Group; label: string; secret: boolean }[] = [
  { key: "tenantId", label: "Tenant ID", secret: false },
  { key: "clientId", label: "Application (client) ID", secret: false },
  { key: "clientSecret", label: "Client secret", secret: true },
];

const OI: { key: keyof Group; label: string; secret: boolean }[] = [
  { key: "issuer", label: "Issuer URL", secret: false },
  { key: "clientId", label: "Client ID", secret: false },
  { key: "redirectUri", label: "Redirect URI", secret: false },
  { key: "clientSecret", label: "Client secret", secret: true },
];

const EXTERNAL_RADIOS: { value: ExternalIdp; label: string; desc: string }[] = [
  { value: "none", label: "No external directory", desc: "Only email/password, if enabled above" },
  { value: "ldap", label: "LDAP / Active Directory", desc: "Bind and search your directory" },
  { value: "azure_ad", label: "Microsoft Entra ID (Azure AD)", desc: "Tenant, app registration, and client secret" },
  { value: "oidc", label: "OpenID Connect", desc: "Issuer, client, redirect URL, and secret" },
];

function extFromData(d: IdentityRes): string {
  return String(d.external.value ?? "none");
}

function localBool(f: Field): boolean {
  const v = f.value;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0" || v === "" || v == null) return false;
  return Boolean(v);
}

function groupDirty(
  rows: { key: keyof Group; label: string; secret: boolean }[],
  group: Group,
  draft: Record<string, string>,
): boolean {
  for (const row of rows) {
    const k = String(row.key);
    const f = group[k];
    if (!f || f.locked) continue;
    const dval = draft[k];
    if (row.secret) {
      if (dval === undefined) continue;
      if (dval.length > 0) return true;
      if (dval === "" && f.configured) return true;
    } else {
      const server = String(f.value ?? "");
      const want = dval !== undefined ? dval : server;
      if (want !== server) return true;
    }
  }
  return false;
}

function hasUnsavedIdentityChanges(
  d: IdentityRes,
  st: {
    local: boolean | null;
    external: ExternalIdp | null;
    ldap: Record<string, string>;
    azure: Record<string, string>;
    oidc: Record<string, string>;
  },
): boolean {
  const sLocal = localBool(d.local);
  const sExt = extFromData(d) as ExternalIdp;
  const curLocal = d.local.locked ? sLocal : st.local != null ? st.local : sLocal;
  const curExt = d.external.locked ? sExt : st.external != null ? st.external : sExt;
  if (!d.local.locked && curLocal !== sLocal) return true;
  if (!d.external.locked && curExt !== sExt) return true;
  if (curExt === "ldap" && groupDirty(LDAP, d.ldap, st.ldap)) return true;
  if (curExt === "azure_ad" && groupDirty(AZ, d.azure, st.azure)) return true;
  if (curExt === "oidc" && groupDirty(OI, d.oidc, st.oidc)) return true;
  return false;
}

export function IdentityPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-identity"],
    queryFn: () => apiJson<IdentityRes>("/v1/admin/identity"),
  });

  const [local, setLocal] = useState<boolean | null>(null);
  const [external, setExternal] = useState<ExternalIdp | null>(null);
  const [ldap, setLdap] = useState<Record<string, string>>({});
  const [azure, setAzure] = useState<Record<string, string>>({});
  const [oidc, setOidc] = useState<Record<string, string>>({});

  const m = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiJson<IdentityRes>("/v1/admin/identity", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-identity"] });
      setLocal(null);
      setExternal(null);
      setLdap({});
      setAzure({});
      setOidc({});
    },
  });

  const hasUnsavedChanges = useMemo(() => {
    if (!q.data) return false;
    return hasUnsavedIdentityChanges(q.data, { local, external, ldap, azure, oidc });
  }, [q.data, local, external, ldap, azure, oidc]);

  if (q.isLoading) {
    return (
      <div className="main">
        <BlockLoader label="Loading identity settings…" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <div className="error-banner">Could not load identity settings. You must be an administrator.</div>;
  }

  const d = q.data;
  const localLocked = d.local.locked;
  const extLocked = d.external.locked;

  const effLocal = localLocked
    ? localBool(d.local)
    : local != null
      ? local
      : localBool(d.local);
  const effExt = (extLocked
    ? extFromData(d)
    : external != null
      ? external
      : extFromData(d)) as ExternalIdp;

  function buildPatch(): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    if (!localLocked) p.localEnabled = effLocal;
    if (!extLocked) p.externalProvider = effExt;

    if (effExt === "ldap") {
      const l: Record<string, unknown> = {};
      for (const row of LDAP) {
        const k = row.key as string;
        const f = d.ldap[k];
        if (!f || f.locked) continue;
        const typed = ldap[k];
        if (k === "bindPassword") {
          if (typed !== undefined) l.bindPassword = typed === "" ? null : typed;
          continue;
        }
        const v = typed !== undefined ? typed : f.value == null || f.value === "" ? null : String(f.value);
        l[k] = v;
      }
      if (Object.keys(l).length) p.ldap = l;
    } else if (effExt === "azure_ad") {
      const a: Record<string, unknown> = {};
      for (const row of AZ) {
        const k = row.key as string;
        const f = d.azure[k];
        if (!f || f.locked) continue;
        if (k === "clientSecret") {
          const t = azure.clientSecret;
          if (t !== undefined) a.clientSecret = t === "" ? null : t;
          continue;
        }
        const t = azure[k];
        const v = t !== undefined ? t : f.value == null ? null : String(f.value);
        a[k] = v;
      }
      if (Object.keys(a).length) p.azure = a;
    } else if (effExt === "oidc") {
      const o: Record<string, unknown> = {};
      for (const row of OI) {
        const k = row.key as string;
        const f = d.oidc[k];
        if (!f || f.locked) continue;
        if (k === "clientSecret") {
          const t = oidc.clientSecret;
          if (t !== undefined) o.clientSecret = t === "" ? null : t;
          continue;
        }
        const t = oidc[k];
        const v = t !== undefined ? t : f.value == null ? null : String(f.value);
        o[k] = v;
      }
      if (Object.keys(o).length) p.oidc = o;
    }
    return p;
  }

  return (
    <>
      <ModelListPageHeader
        title="Sign-in & identity"
        subtitle="You can allow email and password and, at the same time, at most one external sign-in (LDAP, Entra, or OIDC). Set AUTH_* in the environment to override; secrets are never sent to the browser in plaintext."
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        {d.anyEnvironmentLock ? (
          <div
            className="error-banner"
            style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(100, 140, 200, 0.08)", marginBottom: "1rem" }}
          >
            {d.message}
          </div>
        ) : null}
        {m.isError && (
          <div className="error-banner" style={{ marginBottom: "1rem" }}>
            {m.error instanceof Error ? m.error.message : "Save failed"}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!hasUnsavedChanges) return;
            m.mutate(buildPatch());
          }}
        >
          <div className="panel" style={{ maxWidth: "40rem" }}>
            <h3 className="h3" style={{ marginTop: 0 }} id="signin-local-heading">
              Email and password
            </h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
              {d.help}
            </p>
            {localLocked ? (
              <div>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>Local accounts</span>
                {roBlock(d.local)}
              </div>
            ) : (
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!effLocal}
                  onChange={(e) => setLocal(e.target.checked)}
                  style={{ marginTop: "0.2rem" }}
                />
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>Allow sign-in with email and password</span>
                  <span className="muted" style={{ fontSize: "0.9rem" }}>
                    You can keep this on together with a directory below (break-glass or separate users).
                  </span>
                </span>
              </label>
            )}
          </div>

          <div className="panel" style={{ maxWidth: "40rem", marginTop: "1.25rem" }}>
            <h3 className="h3" style={{ marginTop: 0 }} id="signin-ext-heading">
              External sign-in
            </h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
              Choose at most one directory. Only the selected type shows fields below.
            </p>
            {extLocked ? (
              <div>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>Directory</span>
                {roBlock(d.external)}
              </div>
            ) : (
              <fieldset
                style={{ border: "none", margin: 0, padding: 0 }}
                disabled={m.isPending}
                aria-labelledby="signin-ext-heading"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {EXTERNAL_RADIOS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                        padding: "0.65rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                        background: effExt === opt.value ? "rgba(100, 140, 200, 0.12)" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="external-idp"
                        value={opt.value}
                        checked={effExt === opt.value}
                        onChange={() => setExternal(opt.value)}
                        style={{ marginTop: "0.2rem" }}
                      />
                      <span>
                        <span style={{ display: "block", fontWeight: 600 }}>{opt.label}</span>
                        <span className="muted" style={{ fontSize: "0.9rem" }}>
                          {opt.desc}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>

          {!effLocal && effExt === "none" && !localLocked && !extLocked && (
            <div
              className="error-banner"
              style={{ borderColor: "rgba(255,180,80,0.3)", maxWidth: "40rem", marginTop: "1.25rem" }}
            >
              You need at least one of: email and password, or a directory. Saving will be rejected if both are off.
            </div>
          )}

          {effLocal && !localLocked && effExt === "none" && (
            <div className="panel" style={{ maxWidth: "40rem", marginTop: "1.25rem" }}>
              <h3 className="h3" style={{ marginTop: 0 }} id="local-only-note">
                Local-only sign-in
              </h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Create users in User management. No external directory is used.
              </p>
            </div>
          )}

          {effExt === "ldap" && (
            <div className="panel" style={{ maxWidth: "40rem", marginTop: "1.25rem" }}>
              <h3 className="h3" style={{ marginTop: 0 }}>
                LDAP / AD
              </h3>
              {effLocal && (
                <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                  Email and password can stay enabled in addition to LDAP, if you use both in parallel.
                </p>
              )}
              {LDAP.map(({ key, label, secret }) => {
                const f = d.ldap[key];
                if (!f) return null;
                const v =
                  (ldap[key] as string | undefined) ?? (f.sensitive && !f.locked ? (f.configured ? "" : "") : f.value == null ? "" : String(f.value));
                return (
                  <FieldInput
                    key={key}
                    label={label}
                    f={f}
                    value={v}
                    onChange={(nv) => setLdap((prev) => ({ ...prev, [key]: nv }))}
                    type={secret ? "password" : "text"}
                  />
                );
              })}
            </div>
          )}

          {effExt === "azure_ad" && (
            <div className="panel" style={{ maxWidth: "40rem", marginTop: "1.25rem" }}>
              <h3 className="h3" style={{ marginTop: 0 }}>
                Microsoft Entra
              </h3>
              {effLocal && (
                <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                  You can also allow email and password above for the same or different user accounts.
                </p>
              )}
              {AZ.map(({ key, label, secret }) => {
                const f = d.azure[key];
                if (!f) return null;
                const v = (azure[key] as string | undefined) ?? (f.sensitive && !f.locked ? (f.configured ? "" : "") : f.value == null ? "" : String(f.value));
                return (
                  <FieldInput
                    key={key}
                    label={label}
                    f={f}
                    value={v}
                    onChange={(nv) => setAzure((prev) => ({ ...prev, [key]: nv }))}
                    type={secret ? "password" : "text"}
                  />
                );
              })}
            </div>
          )}

          {effExt === "oidc" && (
            <div className="panel" style={{ maxWidth: "40rem", marginTop: "1.25rem" }}>
              <h3 className="h3" style={{ marginTop: 0 }}>
                OpenID Connect
              </h3>
              {effLocal && (
                <p className="muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                  You can also allow email and password above in parallel with OIDC.
                </p>
              )}
              {OI.map(({ key, label, secret }) => {
                const f = d.oidc[key];
                if (!f) return null;
                const v = (oidc[key] as string | undefined) ?? (f.sensitive && !f.locked ? (f.configured ? "" : "") : f.value == null ? "" : String(f.value));
                return (
                  <FieldInput
                    key={key}
                    label={label}
                    f={f}
                    value={v}
                    onChange={(nv) => setOidc((prev) => ({ ...prev, [key]: nv }))}
                    type={secret ? "password" : "text"}
                  />
                );
              })}
            </div>
          )}

          <p style={{ marginTop: "1.25rem" }}>
            <button type="submit" className="btn btn-primary" disabled={m.isPending || !hasUnsavedChanges} title={!hasUnsavedChanges ? "No changes to save" : undefined}>
              {m.isPending ? <InlineLoader label="Saving…" /> : "Save changes"}
            </button>
            {localLocked && extLocked ? (
              <span className="muted" style={{ marginLeft: "0.75rem" }} title={LOCK_MSG}>
                Local and external mode are set in the environment. You may still be able to edit directory details below
                that are not overridden by AUTH_*.
              </span>
            ) : null}
          </p>
        </form>
      </div>
    </>
  );
}
