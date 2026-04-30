import { useMemo } from "react";
import {
  getBuiltinFieldSpecs,
  getCustomFieldSpecs,
  mergeCustomFieldsIntoDefinition,
  specToRow,
  validateCustomFieldRows,
  type CustomFieldRow,
  type CustomFieldType,
} from "./objectTemplateCustomFieldsMerge";

const TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "uuid", label: "UUID" },
  { value: "json", label: "JSON (any)" },
];

export function ObjectTemplateCustomFieldsEditor({
  definition,
  onDefinitionChange,
}: {
  definition: Record<string, unknown>;
  onDefinitionChange: (next: Record<string, unknown>) => void;
}) {
  const builtinCount = useMemo(() => getBuiltinFieldSpecs(definition).length, [definition]);
  const rows = useMemo(() => getCustomFieldSpecs(definition).map(specToRow), [definition]);
  const strict = Boolean(definition.strictCustomAttributes);

  function push(rowsNext: CustomFieldRow[], strictNext = strict) {
    onDefinitionChange(mergeCustomFieldsIntoDefinition(definition, rowsNext, strictNext));
  }

  function updateRow(index: number, patch: Partial<CustomFieldRow>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    push(next);
  }

  function addRow() {
    push([
      ...rows,
      {
        key: "",
        label: "",
        type: "string",
        required: false,
        pattern: "",
        minLength: "",
        maxLength: "",
        minimum: "",
        maximum: "",
        enumLines: "",
      },
    ]);
  }

  function removeRow(index: number) {
    push(rows.filter((_, i) => i !== index));
  }

  const previewErr = validateCustomFieldRows(rows);

  return (
    <div
      className="form-stack"
      style={{
        gap: "0.65rem",
        padding: "0.75rem",
        borderRadius: "8px",
        border: "1px solid var(--border-subtle, rgba(127,127,127,0.22))",
        background: "var(--surface-raised, rgba(127,127,127,0.06))",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Custom attribute fields</div>
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          {builtinCount} built-in field{builtinCount === 1 ? "" : "s"} (edit full JSON to change)
        </span>
      </div>

      <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", margin: 0 }}>
        <input
          type="checkbox"
          checked={strict}
          onChange={(e) => push(rows, e.target.checked)}
        />
        <span style={{ fontSize: "0.85rem" }}>Strict: reject custom keys not listed below</span>
      </label>

      {previewErr ? <div className="error-banner" style={{ margin: 0, fontSize: "0.82rem" }}>{previewErr}</div> : null}

      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          No custom fields yet. Add one to validate extra key/value pairs under Custom attributes on DCIM forms.
        </p>
      ) : (
        <div className="form-stack" style={{ gap: "0.75rem" }}>
          {rows.map((row, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(7rem, 1fr) minmax(7rem, 1fr) 8rem auto",
                gap: "0.45rem 0.5rem",
                alignItems: "end",
                paddingBottom: "0.65rem",
                borderBottom: "1px solid var(--border-subtle, rgba(127,127,127,0.15))",
              }}
            >
              <label style={{ margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  Key
                </span>
                <input
                  className="input mono"
                  style={{ fontSize: "0.82rem" }}
                  value={row.key}
                  onChange={(e) => updateRow(index, { key: e.target.value })}
                  placeholder="costCenter"
                  spellCheck={false}
                />
              </label>
              <label style={{ margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  Label
                </span>
                <input
                  className="input"
                  style={{ fontSize: "0.82rem" }}
                  value={row.label}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                  placeholder="Cost center"
                />
              </label>
              <label style={{ margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  Type
                </span>
                <select
                  className="input"
                  style={{ fontSize: "0.82rem" }}
                  value={row.type}
                  onChange={(e) => updateRow(index, { type: e.target.value as CustomFieldType })}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end", paddingBottom: "0.15rem" }}>
                <label style={{ flexDirection: "row", alignItems: "center", gap: "0.25rem", margin: 0, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={row.required} onChange={(e) => updateRow(index, { required: e.target.checked })} />
                  <span style={{ fontSize: "0.78rem" }}>Req</span>
                </label>
                <button type="button" className="btn btn-ghost" style={{ padding: "0.25rem 0.45rem", fontSize: "0.78rem" }} onClick={() => removeRow(index)}>
                  Remove
                </button>
              </div>

              {(row.type === "string" || row.type === "textarea") && (
                <label style={{ gridColumn: "1 / -1", margin: 0 }}>
                  <span className="muted" style={{ fontSize: "0.72rem" }}>
                    Pattern (regex, optional)
                  </span>
                  <input
                    className="input mono"
                    style={{ fontSize: "0.82rem" }}
                    value={row.pattern}
                    onChange={(e) => updateRow(index, { pattern: e.target.value })}
                    placeholder="^[A-Z0-9-]+$"
                    spellCheck={false}
                  />
                </label>
              )}

              {(row.type === "string" || row.type === "textarea") && (
                <>
                  <label style={{ margin: 0 }}>
                    <span className="muted" style={{ fontSize: "0.72rem" }}>
                      Min length
                    </span>
                    <input
                      className="input mono"
                      style={{ fontSize: "0.82rem" }}
                      value={row.minLength}
                      onChange={(e) => updateRow(index, { minLength: e.target.value })}
                      inputMode="numeric"
                    />
                  </label>
                  <label style={{ margin: 0 }}>
                    <span className="muted" style={{ fontSize: "0.72rem" }}>
                      Max length
                    </span>
                    <input
                      className="input mono"
                      style={{ fontSize: "0.82rem" }}
                      value={row.maxLength}
                      onChange={(e) => updateRow(index, { maxLength: e.target.value })}
                      inputMode="numeric"
                    />
                  </label>
                </>
              )}

              {(row.type === "number" || row.type === "integer") && (
                <>
                  <label style={{ margin: 0 }}>
                    <span className="muted" style={{ fontSize: "0.72rem" }}>
                      Minimum
                    </span>
                    <input
                      className="input mono"
                      style={{ fontSize: "0.82rem" }}
                      value={row.minimum}
                      onChange={(e) => updateRow(index, { minimum: e.target.value })}
                      inputMode="decimal"
                    />
                  </label>
                  <label style={{ margin: 0 }}>
                    <span className="muted" style={{ fontSize: "0.72rem" }}>
                      Maximum
                    </span>
                    <input
                      className="input mono"
                      style={{ fontSize: "0.82rem" }}
                      value={row.maximum}
                      onChange={(e) => updateRow(index, { maximum: e.target.value })}
                      inputMode="decimal"
                    />
                  </label>
                </>
              )}

              <label style={{ gridColumn: "1 / -1", margin: 0 }}>
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  Allowed values (optional, one per line → enum)
                </span>
                <textarea
                  className="input mono"
                  style={{ fontSize: "0.78rem", minHeight: "3.25rem", resize: "vertical" }}
                  value={row.enumLines}
                  onChange={(e) => updateRow(index, { enumLines: e.target.value })}
                  placeholder={"PLANNED\nACTIVE"}
                  spellCheck={false}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      <div>
        <button type="button" className="btn btn-ghost" onClick={addRow}>
          Add custom field
        </button>
      </div>
    </div>
  );
}
