import { ModelListPageHeader } from "../../components/ModelListPageHeader";

const LINKS: { href: string; label: string; desc: string }[] = [
  { href: "/docs", label: "OpenAPI UI (Swagger)", desc: "Interactive REST reference for this deployment." },
  { href: "/docs/json", label: "OpenAPI JSON", desc: "Machine-readable spec (useful for clients and codegen)." },
  { href: "/graphql", label: "GraphQL endpoint", desc: "Read-oriented schema (POST with a query body)." },
  { href: "/graphiql", label: "GraphiQL", desc: "In-browser GraphQL explorer when enabled on the server." },
];

export function AdminDocsPage() {
  return (
    <>
      <ModelListPageHeader
        title="Documentation & API"
        subtitle="Entry points for this environment’s API surface"
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        <ul className="admin-docs-list" style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: "36rem" }}>
          {LINKS.map((l) => (
            <li key={l.href} className="panel" style={{ marginBottom: "0.75rem" }}>
              <a href={l.href} className="admin-docs-link" target="_blank" rel="noreferrer">
                {l.label}
              </a>
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                {l.desc}
              </p>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: "1rem" }}>
          REST base path: <code className="mono">/v1/…</code> · Session cookies are for the console; use Bearer tokens for automation.
        </p>
      </div>
    </>
  );
}
