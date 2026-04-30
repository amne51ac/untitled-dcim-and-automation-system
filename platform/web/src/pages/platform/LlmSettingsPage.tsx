import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../api/client";
import { ModelListPageHeader } from "../../components/ModelListPageHeader";
import { BlockLoader, InlineLoader } from "../../components/Loader";

const LOCK = "LLM settings configured in the environment cannot be changed in the interface";

type LlmRes = {
  enabled: boolean;
  baseUrl: string | null;
  defaultModel: string | null;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  fieldSources: Record<string, string>;
  fieldLocked: Record<string, boolean>;
  message: string | null;
};

function FieldReadonly({ children, title }: { children: string; title?: string }) {
  return (
    <p
      className="mono llm-readonly-value"
      title={title}
    >
      {children}
    </p>
  );
}

const INPUT_BLOCK = { display: "block" as const, width: "100%" as const, marginTop: "0.35rem" as const, marginBottom: "0.75rem" as const };

export function LlmSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "llm"],
    queryFn: () => apiJson<LlmRes>("/v1/admin/llm"),
  });

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");

  const d = q.data;
  useEffect(() => {
    if (!d) return;
    setEnabled(d.enabled);
    setBaseUrl(d.baseUrl ?? "");
    setDefaultModel(d.defaultModel ?? "gpt-4.1-mini");
    setApiKey("");
  }, [d]);

  const hasUnsavedChanges = useMemo(() => {
    if (!d) return false;
    const l = d.fieldLocked;
    if (Object.values(l).every((x) => x)) return false;
    if (!l.enabled && enabled !== d.enabled) return true;
    if (!l.baseUrl && (baseUrl.trim() || "") !== (d.baseUrl ?? "").trim()) return true;
    if (!l.defaultModel && (defaultModel.trim() || "gpt-4.1-mini") !== (d.defaultModel ?? "gpt-4.1-mini").trim()) {
      return true;
    }
    if (!l.apiKey && apiKey.trim() !== "") return true;
    return false;
  }, [d, enabled, baseUrl, defaultModel, apiKey]);

  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiJson<LlmRes>("/v1/admin/llm", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "llm"] });
    },
  });

  const testMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiJson<{ ok: boolean; message: string }>("/v1/admin/llm/test", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });

  if (q.isLoading) {
    return (
      <>
        <ModelListPageHeader
          title="LLM & AI assistant"
          subtitle="Configure an OpenAI-compatible chat API for the in-app AI assistant."
          showPin={false}
          showBulkTools={false}
        />
        <div className="main-body">
          <BlockLoader label="Loading…" />
        </div>
      </>
    );
  }

  if (q.isError || !d) {
    return (
      <>
        <ModelListPageHeader
          title="LLM & AI assistant"
          subtitle="Configure an OpenAI-compatible chat API for the in-app AI assistant."
          showPin={false}
          showBulkTools={false}
        />
        <div className="main-body">
          <div className="error-banner">Failed to load LLM settings (admin only).</div>
        </div>
      </>
    );
  }

  const l = d.fieldLocked;
  const allLocked = Object.values(l).every((x) => x);

  return (
    <>
      <ModelListPageHeader
        title="LLM & AI assistant"
        subtitle="OpenAI-compatible /v1/chat/completions. Values set in the environment (LLM_*) override the database; those fields are read-only here. Secrets are never sent to the browser in plaintext."
        showPin={false}
        showBulkTools={false}
      />
      <div className="main-body">
        {d.message || Object.values(l).some(Boolean) ? (
          <div
            className="error-banner"
            style={{ borderColor: "rgba(255, 255, 255, 0.12)", background: "rgba(100, 140, 200, 0.08)", marginBottom: "1.25rem" }}
          >
            {d.message || LOCK}
          </div>
        ) : null}

        {mut.isError ? (
          <div className="error-banner" style={{ marginBottom: "1.25rem" }}>
            {mut.error instanceof Error ? mut.error.message : "Save failed"}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!hasUnsavedChanges) return;
            const body: Record<string, unknown> = { enabled, baseUrl: baseUrl.trim() || null, defaultModel: defaultModel.trim() || null };
            if (apiKey.trim() !== "") body.apiKey = apiKey;
            if (d.apiKeySet && apiKey.trim() === "" && l.apiKey) {
              delete body.apiKey;
            }
            mut.mutate(body);
          }}
        >
          <div className="panel" style={{ maxWidth: "40rem" }}>
            <h3 className="h3" style={{ marginTop: 0 }}>
              LLM provider
            </h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: "1rem" }}>
              <strong>OpenAI / proxies:</strong> use an API root that ends in <code className="mono">/v1</code> (or only the host;{" "}
              <code className="mono">/v1</code> is added). <strong>Azure OpenAI:</strong> set the resource base{" "}
              <code className="mono">https://your-resource.openai.azure.com</code> (no path) and set <strong>default model</strong> to
              your <em>deployment</em> name. Auth uses the API key from the Azure portal with the correct headers for each provider.
            </p>

            <div className="form-stack" style={{ gap: "0.1rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: l.enabled ? "default" : "pointer",
                  opacity: l.enabled ? 0.85 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  disabled={l.enabled}
                  style={{ marginTop: "0.2rem" }}
                />
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>Enable AI assistant</span>
                  <span className="muted" style={{ fontSize: "0.88rem", display: "block", marginTop: "0.2rem" }}>
                    Requires a reachable base URL and API key (from the database or environment). Source:{" "}
                    <span className="mono badge">{d.fieldSources.enabled ?? "—"}</span>
                  </span>
                </span>
              </label>

              <div>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Base URL
                  <span className="mono" style={{ marginLeft: "0.45rem", fontSize: "0.72em", color: "var(--text-low)" }}>
                    {d.fieldSources.baseUrl}
                  </span>
                </span>
                {l.baseUrl ? (
                  <FieldReadonly title={LOCK}>
                    {d.baseUrl || "—"}
                  </FieldReadonly>
                ) : (
                  <input
                    id="llm-base"
                    className="input"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    style={INPUT_BLOCK}
                  />
                )}
              </div>

              <div>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Default model
                  <span className="mono" style={{ marginLeft: "0.45rem", fontSize: "0.72em", color: "var(--text-low)" }}>
                    {d.fieldSources.defaultModel}
                  </span>
                </span>
                {l.defaultModel ? (
                  <FieldReadonly title={LOCK}>
                    {d.defaultModel || "—"}
                  </FieldReadonly>
                ) : (
                  <input
                    id="llm-model"
                    className="input"
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    style={INPUT_BLOCK}
                  />
                )}
              </div>

              <div>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  API key
                  <span className="mono" style={{ marginLeft: "0.45rem", fontSize: "0.72em", color: "var(--text-low)" }}>
                    {d.fieldSources.apiKey}
                  </span>
                </span>
                {l.apiKey ? (
                  <FieldReadonly title={LOCK}>
                    {d.apiKeyMasked || "set in environment"}
                  </FieldReadonly>
                ) : (
                  <>
                    {d.apiKeySet ? (
                      <p className="form-hint" style={{ margin: "0 0 0.4rem" }}>
                        Stored: <span className="mono">{d.apiKeyMasked}</span> — enter a new value to replace, or leave blank to keep.
                      </p>
                    ) : null}
                    <input
                      className="input"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                      placeholder="sk-…"
                      style={INPUT_BLOCK}
                    />
                  </>
                )}
              </div>
            </div>

            <p className="form-hint" style={{ marginTop: "1rem", marginBottom: 0, maxWidth: "36rem" }}>
              In production, prefer <code className="mono">LLM_BASE_URL</code>, <code className="mono">LLM_API_KEY</code>,{" "}
              <code className="mono">LLM_DEFAULT_MODEL</code>, and optional <code className="mono">LLM_ENABLED</code> in <code className="mono">.env</code>{" "}
              to lock settings and keep secrets out of the database.
            </p>
          </div>

          {testMut.isError ? (
            <div className="error-banner" style={{ marginTop: "1rem", maxWidth: "40rem" }}>
              {testMut.error instanceof Error ? testMut.error.message : "Connection test failed"}
            </div>
          ) : null}
          {testMut.isSuccess && testMut.data ? (
            <p className="form-hint" style={{ marginTop: "0.75rem", maxWidth: "40rem" }} role="status">
              {testMut.data.ok ? "Connection test: " : "Connection test failed: "}
              {testMut.data.message}
            </p>
          ) : null}

          <p style={{ marginTop: "1.25rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={
                testMut.isPending ||
                (!l.baseUrl && !baseUrl.trim()) ||
                (!l.apiKey && !apiKey.trim() && !d.apiKeySet)
              }
              title={
                !d.apiKeySet && !l.apiKey && !apiKey.trim()
                  ? "Set an API key to test, or save one in the database first"
                  : !l.baseUrl && !baseUrl.trim()
                    ? "Enter a base URL to test the connection"
                    : undefined
              }
              onClick={() => {
                const body: Record<string, unknown> = {
                  baseUrl: baseUrl.trim() || null,
                  defaultModel: defaultModel.trim() || null,
                };
                if (apiKey.trim() !== "") body.apiKey = apiKey;
                void testMut.mutateAsync(body);
              }}
            >
              {testMut.isPending ? <InlineLoader label="Testing…" /> : "Test connection"}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={mut.isPending || allLocked || !hasUnsavedChanges}
              title={allLocked ? "All values are set in the environment" : !hasUnsavedChanges ? "No changes to save" : undefined}
            >
              {mut.isPending ? <InlineLoader label="Saving…" /> : "Save changes"}
            </button>
            {allLocked ? (
              <span className="muted" style={{ marginLeft: "0.25rem" }}>
                Every field is overridden by environment variables; change LLM_* in the deployment to adjust behavior.
              </span>
            ) : mut.isSuccess && !mut.isPending && !testMut.isPending ? (
              <span className="muted" style={{ marginLeft: "0.25rem" }}>
                Saved.
              </span>
            ) : null}
          </p>
        </form>
      </div>
    </>
  );
}
