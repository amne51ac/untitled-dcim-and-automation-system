import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import { apiJson, ApiRequestError } from "../../api/client";
import { ajvErrorsToFieldMap, validateDeviceCreateBody, validateDeviceUpdateBody } from "../../validation/ajvDcim";
import { inputStyleForField, mergeFieldErrors } from "../../validation/formFieldError";
import { validateCoercedCustomAttributes } from "../../validation/templateCustomAttributes";
import { coerceCustomAttributes, KeyValueEditor, stringMapFromUnknown } from "../../components/KeyValueEditor";
import { FormPageShell } from "../../components/FormPageShell";
import { InlineLoader } from "../../components/Loader";

const STATUSES = ["PLANNED", "STAGED", "ACTIVE", "DECOMMISSIONED"] as const;

export type DeviceRow = {
  id: string;
  name: string;
  status: string;
  serialNumber?: string | null;
  positionU?: number | null;
  face?: string | null;
  rack: { id: string; name: string } | null;
  deviceType: { id: string; model: string; manufacturer: { name: string } };
  deviceRole: { id: string; name: string };
  templateId?: string | null;
  customAttributes?: Record<string, unknown>;
};

type TemplateOpt = {
  id: string;
  name: string;
  slug: string;
  isDefault?: boolean;
  customAttributesJsonSchema?: Record<string, unknown>;
};
type DtOpt = { id: string; model: string; manufacturer: { name: string } };
type DrOpt = { id: string; name: string };
type RackOpt = { id: string; name: string };

export function DeviceFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = useMatch({ path: "/dcim/devices/new", end: true }) !== null;
  const { deviceId } = useParams<{ deviceId: string }>();
  const id = isNew ? undefined : deviceId;

  const dtQ = useQuery({
    queryKey: ["device-types"],
    queryFn: () => apiJson<{ items: DtOpt[] }>("/v1/device-types"),
  });
  const drQ = useQuery({
    queryKey: ["device-roles"],
    queryFn: () => apiJson<{ items: DrOpt[] }>("/v1/device-roles"),
  });
  const racksQ = useQuery({
    queryKey: ["racks"],
    queryFn: () => apiJson<{ items: RackOpt[] }>("/v1/racks"),
  });
  const templatesQ = useQuery({
    queryKey: ["templates", "Device"],
    queryFn: () => apiJson<{ items: TemplateOpt[] }>("/v1/templates?resourceType=Device"),
  });
  const detailQ = useQuery({
    queryKey: ["device", id],
    queryFn: () => apiJson<{ item: DeviceRow }>(`/v1/devices/${id}`),
    enabled: Boolean(id),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiJson<{ item: DeviceRow }>("/v1/devices", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["devices"] });
      navigate(`/dcim/devices/${data.item.id}/edit`, { replace: true });
    },
  });

  const patchMut = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      apiJson(`/v1/devices/${args.id}`, { method: "PATCH", body: JSON.stringify(args.body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["devices"] });
      void qc.invalidateQueries({ queryKey: ["device", id] });
    },
  });

  const initial = isNew ? null : detailQ.data?.item ?? null;

  if (!isNew && detailQ.isLoading) {
    return (
      <FormPageShell title="Edit device" backTo="/dcim/devices" backLabel="Back to devices">
        <InlineLoader label="Loading device…" />
      </FormPageShell>
    );
  }
  if (!isNew && (detailQ.error || !initial)) {
    return (
      <FormPageShell title="Edit device" backTo="/dcim/devices" backLabel="Back to devices">
        <div className="error-banner">{detailQ.error ? String(detailQ.error) : "Not found"}</div>
      </FormPageShell>
    );
  }

  const refsLoading = dtQ.isLoading || drQ.isLoading || racksQ.isLoading || templatesQ.isLoading;
  if (refsLoading) {
    return (
      <FormPageShell
        title={isNew ? "New device" : "Edit device"}
        subtitle={isNew ? "Register hardware in a rack or unracked." : undefined}
        backTo="/dcim/devices"
        backLabel="Back to devices"
      >
        <InlineLoader label="Loading form options…" />
      </FormPageShell>
    );
  }

  const mutErr = createMut.error ?? patchMut.error;
  return (
    <DeviceFormInner
      mode={isNew ? "create" : "edit"}
      initial={initial}
      deviceTypes={dtQ.data?.items ?? []}
      deviceRoles={drQ.data?.items ?? []}
      racks={racksQ.data?.items ?? []}
      templates={templatesQ.data?.items ?? []}
      submitting={createMut.isPending || patchMut.isPending}
      errorBanner={mutErr && !(mutErr instanceof ApiRequestError) ? String(mutErr) : null}
      serverValidationError={mutErr instanceof ApiRequestError ? mutErr : null}
      onCancel={() => navigate("/dcim/devices")}
      onSaveCreate={(body) => createMut.mutate(body)}
      onSaveEdit={id ? (body) => patchMut.mutate({ id, body }) : undefined}
      editResourceId={id}
    />
  );
}

function DeviceFormInner({
  mode,
  initial,
  deviceTypes,
  deviceRoles,
  racks,
  templates,
  submitting,
  errorBanner,
  serverValidationError,
  onCancel,
  onSaveCreate,
  onSaveEdit,
  editResourceId,
}: {
  mode: "create" | "edit";
  initial: DeviceRow | null;
  deviceTypes: DtOpt[];
  deviceRoles: DrOpt[];
  racks: RackOpt[];
  templates: TemplateOpt[];
  submitting: boolean;
  errorBanner: string | null;
  serverValidationError: ApiRequestError | null;
  onCancel: () => void;
  onSaveCreate: (body: Record<string, unknown>) => void;
  onSaveEdit: ((body: Record<string, unknown>) => void) | undefined;
  editResourceId?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [deviceTypeId, setDeviceTypeId] = useState(initial?.deviceType?.id ?? deviceTypes[0]?.id ?? "");
  const [deviceRoleId, setDeviceRoleId] = useState(initial?.deviceRole?.id ?? deviceRoles[0]?.id ?? "");
  const [rackId, setRackId] = useState(initial?.rack?.id ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [positionU, setPositionU] = useState(initial?.positionU != null ? String(initial.positionU) : "");
  const [face, setFace] = useState(initial?.face ?? "");
  const [status, setStatus] = useState(
    initial?.status && STATUSES.includes(initial.status as (typeof STATUSES)[number]) ? initial.status : "PLANNED",
  );
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [kv, setKv] = useState<Record<string, string>>(() =>
    initial?.customAttributes ? stringMapFromUnknown(initial.customAttributes) : {},
  );
  const [clientFieldErr, setClientFieldErr] = useState<Record<string, string>>({});
  const [serverFieldErr, setServerFieldErr] = useState<Record<string, string>>({});
  const [localErr, setLocalErr] = useState<string | null>(null);
  const defaultTpl = templates.find((t) => t.isDefault);
  const fieldErr = useMemo(
    () => mergeFieldErrors(clientFieldErr, serverFieldErr),
    [clientFieldErr, serverFieldErr],
  );

  useEffect(() => {
    if (serverValidationError) {
      setServerFieldErr(serverValidationError.fieldMessages());
    }
  }, [serverValidationError]);

  function buildBody(): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
    if (!name.trim() || !deviceTypeId || !deviceRoleId) {
      return { ok: false, message: "Name, device type, and role are required." };
    }
    const posRaw = positionU.trim();
    let positionUval: number | null = null;
    if (posRaw) {
      const n = Number(posRaw);
      if (Number.isNaN(n)) {
        return { ok: false, message: "Position (U) must be a number." };
      }
      positionUval = n;
    }
    const rawFace = face.trim().toLowerCase();
    let faceVal: "front" | "rear" | null = null;
    if (rawFace === "front" || rawFace === "rear") {
      faceVal = rawFace;
    } else if (rawFace) {
      return { ok: false, message: 'Face must be "front" or "rear" (or leave empty).' };
    }
    return {
      ok: true,
      data: {
        name: name.trim(),
        deviceTypeId,
        deviceRoleId,
        rackId: rackId || null,
        serialNumber: serialNumber.trim() || null,
        positionU: positionUval,
        face: faceVal,
        status,
        templateId: templateId || null,
        customAttributes: coerceCustomAttributes(kv),
      },
    };
  }

  function computeClientFieldErrors(): Record<string, string> {
    const built = buildBody();
    if (!built.ok) {
      return { _root: built.message };
    }
    const v = mode === "create" ? validateDeviceCreateBody(built.data) : validateDeviceUpdateBody(built.data);
    const base = v.ok ? {} : ajvErrorsToFieldMap(v.errors);
    const tpl = templates.find((t) => t.id === templateId) ?? templates.find((t) => t.isDefault);
    const caErr = validateCoercedCustomAttributes(coerceCustomAttributes(kv), tpl?.customAttributesJsonSchema);
    return { ...base, ...caErr };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    setServerFieldErr({});
    const built = buildBody();
    if (!built.ok) {
      setLocalErr(built.message);
      setClientFieldErr({ _root: built.message });
      return;
    }
    const merged = computeClientFieldErrors();
    setClientFieldErr(merged);
    if (Object.keys(merged).length > 0) return;
    if (mode === "create") onSaveCreate(built.data);
    else onSaveEdit?.(built.data);
  }

  const canSubmitAjv = useMemo(() => {
    return Object.keys(computeClientFieldErrors()).length === 0;
  }, [
    mode,
    name,
    deviceTypeId,
    deviceRoleId,
    rackId,
    serialNumber,
    positionU,
    face,
    status,
    templateId,
    kv,
    templates,
  ]);

  return (
    <FormPageShell
      title={mode === "create" ? "New device" : "Edit device"}
      subtitle={mode === "create" ? "Register hardware in a rack or unracked." : undefined}
      backTo="/dcim/devices"
      backLabel="Back to devices"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="device-form"
            className="btn btn-primary"
            disabled={submitting || !canSubmitAjv}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="device-form"
        className="form-stack"
        onSubmit={handleSubmit}
        onBlurCapture={() => {
          setServerFieldErr({});
          setClientFieldErr(computeClientFieldErrors());
        }}
      >
        {localErr ? <div className="error-banner">{localErr}</div> : null}
        {errorBanner ? <div className="error-banner">{errorBanner}</div> : null}
        {fieldErr._root ? <div className="error-banner">{fieldErr._root}</div> : null}
        {editResourceId ? (
          <p className="muted" style={{ margin: 0 }}>
            <Link to={`/o/Device/${editResourceId}`}>View relationships (graph)</Link>
          </p>
        ) : null}
        <label>
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "name")}
            autoComplete="off"
          />
          {fieldErr.name ? <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.name}</span> : null}
        </label>
        <label>
          Device type
          <select
            className="input"
            value={deviceTypeId}
            onChange={(e) => {
              setDeviceTypeId(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "deviceTypeId")}
          >
            {deviceTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.manufacturer.name} {t.model}
              </option>
            ))}
          </select>
          {fieldErr.deviceTypeId ? (
            <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.deviceTypeId}</span>
          ) : null}
        </label>
        <label>
          Role
          <select
            className="input"
            value={deviceRoleId}
            onChange={(e) => {
              setDeviceRoleId(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "deviceRoleId")}
          >
            {deviceRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rack (optional)
          <select
            className="input"
            value={rackId}
            onChange={(e) => {
              setRackId(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "rackId")}
          >
            <option value="">— None —</option>
            {racks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {fieldErr.rackId ? <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.rackId}</span> : null}
        </label>
        <label>
          Serial number
          <input
            className="input"
            value={serialNumber}
            onChange={(e) => {
              setSerialNumber(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "serialNumber")}
          />
        </label>
        <label>
          Position (U)
          <input
            className="input"
            value={positionU}
            onChange={(e) => {
              setPositionU(e.target.value);
              setServerFieldErr({});
            }}
            inputMode="numeric"
            style={inputStyleForField(fieldErr, "positionU")}
          />
        </label>
        <label>
          Face
          <input
            className="input"
            value={face}
            onChange={(e) => {
              setFace(e.target.value);
              setServerFieldErr({});
            }}
            placeholder="front / rear"
            style={inputStyleForField(fieldErr, "face")}
          />
        </label>
        <label>
          Status
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "status")}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Template (optional)
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">— None {defaultTpl ? `(default: ${defaultTpl.name})` : ""} —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug}){t.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
        </label>
        <KeyValueEditor value={kv} onChange={setKv} />
        {Object.entries(fieldErr)
          .filter(([k]) => k.startsWith("customAttributes"))
          .map(([k, msg]) => (
            <p key={k} className="muted" style={{ color: "var(--danger)", margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
              {k}: {msg}
            </p>
          ))}
      </form>
    </FormPageShell>
  );
}
