/**
 * Operator guidance: where custom attribute validation rules live (template definition JSON).
 */
export function ObjectTemplateCustomFieldsHelp() {
  return (
    <div
      className="muted"
      style={{
        fontSize: "0.8rem",
        lineHeight: 1.45,
        padding: "0.65rem 0.75rem",
        borderRadius: "6px",
        background: "var(--surface-raised, rgba(127,127,127,0.08))",
        border: "1px solid var(--border-subtle, rgba(127,127,127,0.2))",
      }}
    >
      <p style={{ margin: "0 0 0.45rem", fontWeight: 600, color: "var(--text)" }}>Custom attributes (validation)</p>
      <p style={{ margin: "0 0 0.45rem" }}>
        Rules apply to the <strong>Custom attributes</strong> block on Location / Rack / Device forms when this template is
        selected (or is the default). Use the <strong>custom fields</strong> section below, or edit the full{" "}
        <span className="mono">definition</span> JSON for advanced changes (including built-in fields).
      </p>
      <ul style={{ margin: 0, paddingLeft: "1.15rem" }}>
        <li>
          In JSON, add entries to <span className="mono">fields</span> with <span className="mono">builtin: false</span>, plus{" "}
          <span className="mono">key</span> (stored property name), <span className="mono">label</span>, and{" "}
          <span className="mono">type</span> (<span className="mono">string</span>, <span className="mono">textarea</span>,{" "}
          <span className="mono">number</span>, <span className="mono">integer</span>, <span className="mono">boolean</span>,{" "}
          <span className="mono">uuid</span>, <span className="mono">json</span>).
        </li>
        <li>
          Optional: <span className="mono">required</span>, <span className="mono">pattern</span> (regex),{" "}
          <span className="mono">enum</span> or <span className="mono">options</span>, <span className="mono">minLength</span>/
          <span className="mono">maxLength</span>, <span className="mono">minimum</span>/<span className="mono">maximum</span>.
        </li>
        <li>
          Set root <span className="mono">strictCustomAttributes: true</span> to reject any custom keys not listed in{" "}
          <span className="mono">fields</span>.
        </li>
      </ul>
      <p style={{ margin: "0.45rem 0 0", fontSize: "0.76rem" }}>
        Example field:{" "}
        <code className="mono" style={{ fontSize: "0.72rem" }}>
          {`{ "key": "costCenter", "builtin": false, "label": "Cost center", "type": "string", "required": true, "pattern": "^[A-Z0-9-]+$" }`}
        </code>
      </p>
    </div>
  );
}
