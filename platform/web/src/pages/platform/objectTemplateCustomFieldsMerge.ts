export type CustomFieldSpec = Record<string, unknown>;

const FIELD_TYPES = ["string", "textarea", "number", "integer", "boolean", "uuid", "json"] as const;
export type CustomFieldType = (typeof FIELD_TYPES)[number];

export function isCustomFieldType(s: string): s is CustomFieldType {
  return (FIELD_TYPES as readonly string[]).includes(s);
}

export function isFieldRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/** Entries in definition.fields with builtin === false (custom attribute specs). */
export function getCustomFieldSpecs(definition: Record<string, unknown>): CustomFieldSpec[] {
  const fields = definition.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter((f): f is CustomFieldSpec => isFieldRecord(f) && f.builtin === false);
}

export function getBuiltinFieldSpecs(definition: Record<string, unknown>): CustomFieldSpec[] {
  const fields = definition.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter((f): f is CustomFieldSpec => isFieldRecord(f) && f.builtin !== false);
}

export type CustomFieldRow = {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  pattern: string;
  minLength: string;
  maxLength: string;
  minimum: string;
  maximum: string;
  /** One allowed value per line (stored as enum). */
  enumLines: string;
};

export function specToRow(spec: CustomFieldSpec): CustomFieldRow {
  const key = String(spec.key ?? spec.apiKey ?? "");
  const label = String(spec.label ?? key);
  const rawType = String(spec.type ?? "string").toLowerCase();
  const normalized = rawType === "int" ? "integer" : rawType;
  const type: CustomFieldType = isCustomFieldType(normalized) ? normalized : "string";
  const opts = spec.enum ?? spec.options;
  let enumLines = "";
  if (Array.isArray(opts)) {
    enumLines = opts.map((x) => String(x)).join("\n");
  }
  return {
    key,
    label,
    type,
    required: Boolean(spec.required),
    pattern: spec.pattern != null ? String(spec.pattern) : "",
    minLength: spec.minLength != null ? String(spec.minLength) : "",
    maxLength: spec.maxLength != null ? String(spec.maxLength) : "",
    minimum: spec.minimum != null ? String(spec.minimum) : "",
    maximum: spec.maximum != null ? String(spec.maximum) : "",
    enumLines,
  };
}

export function rowToSpec(row: CustomFieldRow): CustomFieldSpec {
  const spec: CustomFieldSpec = {
    key: row.key.trim(),
    builtin: false,
    label: row.label.trim() || row.key.trim(),
    type: row.type,
  };
  if (row.required) spec.required = true;
  const pattern = row.pattern.trim();
  if (pattern) spec.pattern = pattern;
  const minL = row.minLength.trim();
  if (minL) {
    const n = Number(minL);
    if (!Number.isNaN(n)) spec.minLength = n;
  }
  const maxL = row.maxLength.trim();
  if (maxL) {
    const n = Number(maxL);
    if (!Number.isNaN(n)) spec.maxLength = n;
  }
  const minV = row.minimum.trim();
  if (minV) {
    const n = Number(minV);
    if (!Number.isNaN(n)) spec.minimum = n;
  }
  const maxV = row.maximum.trim();
  if (maxV) {
    const n = Number(maxV);
    if (!Number.isNaN(n)) spec.maximum = n;
  }
  const enumVals = row.enumLines
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (enumVals.length) spec.enum = enumVals;
  return spec;
}

export function mergeCustomFieldsIntoDefinition(
  base: Record<string, unknown>,
  rows: CustomFieldRow[],
  strictCustomAttributes: boolean,
): Record<string, unknown> {
  const builtin = getBuiltinFieldSpecs(base);
  const customSpecs = rows.filter((r) => !isCustomFieldRowBlank(r)).map(rowToSpec);
  const next: Record<string, unknown> = { ...base, fields: [...builtin, ...customSpecs] };
  if (strictCustomAttributes) next.strictCustomAttributes = true;
  else delete next.strictCustomAttributes;
  return next;
}

/** Row with no key and no constraints — e.g. freshly added; omit from merge and skip in key validation. */
export function isCustomFieldRowBlank(row: CustomFieldRow): boolean {
  return (
    !row.key.trim() &&
    !row.label.trim() &&
    !row.pattern.trim() &&
    !row.minLength.trim() &&
    !row.maxLength.trim() &&
    !row.minimum.trim() &&
    !row.maximum.trim() &&
    !row.enumLines.trim() &&
    !row.required
  );
}

export function validateCustomFieldRows(rows: CustomFieldRow[]): string | null {
  const keyRe = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  const seen = new Set<string>();
  for (const row of rows.filter((r) => !isCustomFieldRowBlank(r))) {
    const k = row.key.trim();
    if (!k) return "Each custom field needs a key (API name).";
    if (!keyRe.test(k)) return `Invalid key "${k}". Use letters, digits, underscore; start with a letter.`;
    if (seen.has(k)) return `Duplicate custom field key "${k}".`;
    seen.add(k);
  }
  return null;
}
