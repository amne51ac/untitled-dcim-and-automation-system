import type { CSSProperties } from "react";

/** Merge client (Ajv) and server (FastAPI) field messages; show first error per key. */
export function mergeFieldErrors(
  a: Record<string, string>,
  b: Record<string, string>,
): Record<string, string> {
  return { ...a, ...b };
}

export function inputStyleForField(err: Record<string, string>, key: string): CSSProperties | undefined {
  if (!err[key]) return undefined;
  return { boxShadow: `0 0 0 1px var(--danger)` };
}
