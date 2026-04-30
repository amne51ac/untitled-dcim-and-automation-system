import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

/** JSON Schema for ``customAttributes`` from GET /v1/templates (``customAttributesJsonSchema``). */
export type CustomAttributesRootSchema = Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/** Map first validation issue per dotted path under ``customAttributes`` (e.g. ``customAttributes.tier``). */
export function validateCoercedCustomAttributes(
  coerced: Record<string, unknown>,
  schema: CustomAttributesRootSchema | null | undefined,
): Record<string, string> {
  if (!schema || typeof schema !== "object" || Object.keys(schema).length === 0) {
    return {};
  }
  const validate = ajv.compile(schema);
  const ok = validate(coerced) as boolean;
  if (ok) return {};

  const out: Record<string, string> = {};
  for (const e of (validate.errors ?? []) as ErrorObject[]) {
    const sub = (e.instancePath || "").replace(/^\//, "").replace(/\//g, ".");
    const fieldKey = sub ? `customAttributes.${sub}` : "customAttributes";
    const msg = e.message ? e.message : "Invalid value";
    if (!out[fieldKey]) out[fieldKey] = msg;
  }
  return out;
}
