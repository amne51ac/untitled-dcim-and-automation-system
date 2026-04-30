import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "../api/client";
import { publicAssetUrl } from "../lib/publicAssetUrl";

type AuthProvider = { id: string; label: string; kind: string; enabled: boolean; note?: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[] | null>(null);

  useEffect(() => {
    void apiJson<{ providers: AuthProvider[] }>("/v1/auth/providers")
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiJson("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <img
            src={publicAssetUrl("intentcenter-logo.svg")}
            alt="IntentCenter"
            className="login-wordmark"
            width={280}
            height={56}
          />
          <p className="brand-tagline login-brand-tagline">The operator console for intent-based networks</p>
        </div>
        <h2>Sign in</h2>
      {error ? <div className="error-banner">{error}</div> : null}
        {(() => {
          const localP = providers?.find((p) => p.id === "local");
          const showPassword = providers == null || (localP?.enabled ?? true);
          if (providers && !showPassword) {
            return (
              <p className="muted" style={{ margin: "0 0 1rem" }}>
                Email and password sign-in is disabled. Use a single sign-on option below, or ask an administrator to
                re-enable local sign-in.
              </p>
            );
          }
          return (
            <form onSubmit={onSubmit}>
              <label className="muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                style={{ marginTop: "0.35rem", marginBottom: "0.75rem" }}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                style={{ marginTop: "0.35rem", marginBottom: "1rem" }}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !email.trim() || !password}>
                {loading ? "Signing in…" : "Continue"}
              </button>
            </form>
          );
        })()}
        {providers && providers.filter((p) => p.id !== "local").length > 0 ? (
          <div style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
              Other sign-in options
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {providers
                .filter((p) => p.id !== "local")
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-ghost"
                    disabled={!p.enabled}
                    title={p.note ? String(p.note) : undefined}
                  >
                    {p.label}
                    {!p.enabled ? " (coming soon)" : ""}
                  </button>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
