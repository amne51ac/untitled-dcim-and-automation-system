import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ObjectTemplateCustomFieldsEditor } from "./ObjectTemplateCustomFieldsEditor";
import { ObjectTemplateCustomFieldsHelp } from "./ObjectTemplateCustomFieldsHelp";

export type ObjectTemplateDefinitionPanelHandle = {
  /** Apply JSON textarea to definition (call before save if user may have edited JSON without blurring). */
  flushJson: () => { ok: true; definition: Record<string, unknown> } | { ok: false; error: string };
};

export const ObjectTemplateDefinitionPanel = forwardRef<
  ObjectTemplateDefinitionPanelHandle,
  {
    definition: Record<string, unknown>;
    onDefinitionChange: (next: Record<string, unknown>) => void;
    jsonTextareaRows?: number;
  }
>(function ObjectTemplateDefinitionPanel({ definition, onDefinitionChange, jsonTextareaRows = 12 }, ref) {
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(definition, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jsonDraftRef = useRef(jsonDraft);
  jsonDraftRef.current = jsonDraft;
  const onDefinitionChangeRef = useRef(onDefinitionChange);
  onDefinitionChangeRef.current = onDefinitionChange;

  useImperativeHandle(ref, () => ({
    flushJson: () => {
      try {
        const p = JSON.parse(jsonDraftRef.current) as unknown;
        if (p === null || typeof p !== "object" || Array.isArray(p)) {
          return { ok: false as const, error: "Definition must be a JSON object." };
        }
        const next = p as Record<string, unknown>;
        onDefinitionChangeRef.current(next);
        setJsonErr(null);
        return { ok: true as const, definition: next };
      } catch {
        return { ok: false as const, error: "Invalid JSON in definition." };
      }
    },
  }));

  useEffect(() => {
    if (document.activeElement === jsonTextareaRef.current) return;
    setJsonDraft(JSON.stringify(definition, null, 2));
    setJsonErr(null);
  }, [definition]);

  function onJsonBlur() {
    try {
      const p = JSON.parse(jsonDraft) as unknown;
      if (p === null || typeof p !== "object" || Array.isArray(p)) {
        setJsonErr("Definition must be a JSON object.");
        return;
      }
      setJsonErr(null);
      onDefinitionChange(p as Record<string, unknown>);
    } catch {
      setJsonErr("Invalid JSON.");
    }
  }

  return (
    <>
      <ObjectTemplateCustomFieldsHelp />
      <ObjectTemplateCustomFieldsEditor definition={definition} onDefinitionChange={onDefinitionChange} />
      <label>
        Full definition (advanced JSON)
        <textarea
          ref={jsonTextareaRef}
          className="input mono"
          rows={jsonTextareaRows}
          value={jsonDraft}
          onChange={(e) => {
            setJsonDraft(e.target.value);
            setJsonErr(null);
          }}
          onBlur={onJsonBlur}
          spellCheck={false}
        />
      </label>
      {jsonErr ? (
        <div className="error-banner" style={{ margin: 0, fontSize: "0.85rem" }}>
          {jsonErr}. Apply changes by clicking outside this field, or fix JSON before saving.
        </div>
      ) : null}
    </>
  );
});

ObjectTemplateDefinitionPanel.displayName = "ObjectTemplateDefinitionPanel";
