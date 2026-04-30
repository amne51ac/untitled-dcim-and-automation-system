/** Optional automation token (advanced); primary auth is httpOnly session cookie. */
const TOKEN_KEY = "nims_bearer_token";

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
}

/** POST with JSON body and server-sent events (e.g. copilot chat stream). */
export async function apiSsePost(path: string, body: unknown): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers();
  headers.set("Accept", "text/event-stream");
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
    credentials: "include",
  });
}

function messageFromFastApiBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.detail === "string") return o.detail;
  if (Array.isArray(o.detail)) {
    const parts = o.detail.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: unknown }).msg) : String(x)));
    return parts.filter(Boolean).join("; ");
  }
  if (typeof o.error === "string") return o.error;
  return null;
}

/** FastAPI / Pydantic 422 and structured 400 bodies: `detail` as a list of issues with `loc` and `msg`. */
export type FastApiValidationIssue = {
  loc: (string | number)[];
  msg: string;
  type?: string;
  code?: string;
};

/** Map validation issues to a single message per first-level field under `body` (or `_root`). */
export function mapFastApiValidationDetails(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) return { _root: "Request failed" };
  const out: Record<string, string> = {};
  for (const item of detail) {
    if (!item || typeof item !== "object") continue;
    const rec = item as FastApiValidationIssue;
    if (typeof rec.msg !== "string" || !Array.isArray(rec.loc)) continue;
    const i = rec.loc.indexOf("body");
    let key = "_root";
    if (i >= 0) {
      const rest = rec.loc.slice(i + 1).map(String);
      if (rest.length > 0) key = rest.join(".");
    }
    if (!out[key]) out[key] = rec.msg;
  }
  return out;
}

export class ApiRequestError extends Error {
  readonly status: number;

  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }

  fieldMessages(): Record<string, string> {
    if (this.status === 422 && this.body && typeof this.body === "object") {
      const d = (this.body as { detail?: unknown }).detail;
      return mapFastApiValidationDetails(d);
    }
    if (this.status === 400 && this.body && typeof this.body === "object") {
      const d = (this.body as { detail?: unknown }).detail;
      if (Array.isArray(d)) return mapFastApiValidationDetails(d);
    }
    return { _root: this.message };
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let errBody: unknown;
    let detail = res.statusText;
    try {
      errBody = await res.json();
      detail = messageFromFastApiBody(errBody) ?? detail;
    } catch {
      errBody = null;
    }
    if (res.status === 401) {
      clearStoredToken();
    }
    throw new ApiRequestError(detail || `HTTP ${res.status}`, res.status, errBody);
  }
  return res.json() as Promise<T>;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/v1/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  clearStoredToken();
}
