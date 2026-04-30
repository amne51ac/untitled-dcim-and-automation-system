import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiJson } from "../../api/client";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { InlineLoader } from "../../components/Loader";

export function AdminHealthPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await apiFetch("/health");
      if (!res.ok) throw new Error(res.statusText);
      return res.json() as Promise<Record<string, unknown>>;
    },
  });

  const openApi = useQuery({
    queryKey: ["openapi-info"],
    queryFn: () => apiJson<{ info?: { title?: string; version?: string } }>("/docs/json"),
    retry: false,
  });

  return (
    <>
      <ModelListPageHeader
        title="Service health"
        subtitle="Liveness and build metadata for this API process"
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        <h3 className="h3" style={{ marginTop: 0 }}>
          Liveness
        </h3>
        {health.isLoading ? <InlineLoader /> : null}
        {health.error ? <div className="error-banner">{String(health.error)}</div> : null}
        {health.data ? (
          <pre
            className="mono"
            style={{
              margin: "0 0 1rem",
              padding: "0.75rem 1rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: "0.85rem",
              overflow: "auto",
            }}
          >
            {JSON.stringify(health.data, null, 2)}
          </pre>
        ) : null}

        <h3 className="h3">API package</h3>
        {openApi.isLoading ? <InlineLoader /> : null}
        {openApi.data?.info ? (
          <p className="context-strip-body" style={{ marginTop: 0 }}>
            <strong>{openApi.data.info.title ?? "—"}</strong>{" "}
            <span className="mono badge">{openApi.data.info.version ?? "—"}</span>
          </p>
        ) : openApi.isError ? (
          <p className="muted">OpenAPI JSON not available ({String(openApi.error)}).</p>
        ) : null}

        <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          For deep checks (database, queues), add probes in your deployment and surface them here in a later iteration.
        </p>
      </div>
    </>
  );
}
