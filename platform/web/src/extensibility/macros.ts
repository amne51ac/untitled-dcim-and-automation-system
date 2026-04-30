import type { PageContextValue } from "./PageContext";

const ALLOWED_ROOTS = new Set(["page", "resource", "user", "organization"]);

/** v2: `api.*` is never read from the macro context (defense in depth; future approved reads would be allowlisted in code). */
const BLOCKED_PATH = /^api\./i;

function getByPath(obj: unknown, path: string): unknown {
  if (path.includes("..") || BLOCKED_PATH.test(path)) return undefined;
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return undefined;
  if (!ALLOWED_ROOTS.has(parts[0]!)) return undefined;
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function splitMacroPipes(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQ) {
      cur += c;
      if (c === inQ) inQ = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inQ = c;
      cur += c;
      continue;
    }
    if (c === "|") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() || out.length) out.push(cur);
  return out;
}

const DEFAULT_RE = /^\s*default\s*\(\s*(['"])([\s\S]*?)\1\s*\)\s*$/i;

function applyFilter(value: unknown, rawExpr: string): unknown {
  const expr = rawExpr.trim();
  if (!expr) return value;
  const m = DEFAULT_RE.exec(expr);
  if (m) {
    const fallback = m[2] ?? "";
    if (value === null || value === undefined || value === "") return fallback;
    return value;
  }
  return value;
}

function renderMacroValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    return JSON.stringify(v);
  }
  return String(v);
}

function macroObjectFromContext(ctx: PageContextValue): Record<string, unknown> {
  return {
    page: {
      ...ctx.page,
    },
    resource: ctx.resource,
    user: ctx.user,
    organization: ctx.organization,
  };
}

/**
 * v1: `{{ page.resourceType }}` — roots: page, resource, user, organization
 * v2: filters: `{{ resource.name | default("—") }}` — `api.*` paths are blocked
 */
export function evalMacroTemplate(template: string, ctx: PageContextValue): string {
  const root = macroObjectFromContext(ctx);
  return template.replace(/\{\{[\s\S]+?\}\}/g, (block) => {
    const inner = block.slice(2, -2).trim();
    if (!inner) return "";
    const segments = splitMacroPipes(inner);
    if (segments.length < 1) return "";
    const first = segments[0]!.trim();
    if (BLOCKED_PATH.test(first)) return "";
    let v: unknown = getByPath(root, first);
    for (const filterExpr of segments.slice(1)) {
      v = applyFilter(v, filterExpr);
    }
    return renderMacroValue(v);
  });
}

export function evalMacroBindings(
  raw: Record<string, unknown> | null | undefined,
  ctx: PageContextValue,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") {
      out[k] = evalMacroTemplate(v, ctx);
    }
  }
  return out;
}
