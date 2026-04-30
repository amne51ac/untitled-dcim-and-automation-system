import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiJson, ApiRequestError } from "../../api/client";
import { ajvErrorsToFieldMap, validateLocationCreateBody, validateLocationUpdateBody } from "../../validation/ajvDcim";
import { inputStyleForField, mergeFieldErrors } from "../../validation/formFieldError";
import { validateCoercedCustomAttributes } from "../../validation/templateCustomAttributes";
import { coerceCustomAttributes, KeyValueEditor, stringMapFromUnknown } from "../../components/KeyValueEditor";
import { FormPageShell } from "../../components/FormPageShell";
import { InlineLoader } from "../../components/Loader";
import { LocationMap, rowToMapPoint } from "../../components/LocationMap";

export type LocationRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationType: { id: string; name: string };
  parent: { id: string; name: string } | null;
  templateId?: string | null;
  customAttributes?: Record<string, unknown>;
};

type LocationTypeOpt = { id: string; name: string };
type TemplateOpt = {
  id: string;
  name: string;
  slug: string;
  isDefault?: boolean;
  customAttributesJsonSchema?: Record<string, unknown>;
};

export function LocationFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = useMatch({ path: "/dcim/locations/new", end: true }) !== null;
  const { locationId } = useParams<{ locationId: string }>();
  const id = isNew ? undefined : locationId;

  const typesQ = useQuery({
    queryKey: ["location-types"],
    queryFn: () => apiJson<{ items: LocationTypeOpt[] }>("/v1/location-types"),
  });
  const locationsQ = useQuery({
    queryKey: ["locations"],
    queryFn: () => apiJson<{ items: LocationRow[] }>("/v1/locations"),
  });
  const templatesQ = useQuery({
    queryKey: ["templates", "Location"],
    queryFn: () => apiJson<{ items: TemplateOpt[] }>("/v1/templates?resourceType=Location"),
  });

  const detailQ = useQuery({
    queryKey: ["location", id],
    queryFn: () => apiJson<{ item: LocationRow }>(`/v1/locations/${id}`),
    enabled: Boolean(id),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiJson<{ item: LocationRow }>("/v1/locations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["locations"] });
      navigate(`/dcim/locations/${data.item.id}/edit`, { replace: true });
    },
  });

  const patchMut = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      apiJson(`/v1/locations/${args.id}`, { method: "PATCH", body: JSON.stringify(args.body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["locations"] });
      void qc.invalidateQueries({ queryKey: ["location", id] });
    },
  });

  const initial = isNew ? null : detailQ.data?.item ?? null;

  if (!isNew && detailQ.isLoading) {
    return (
      <FormPageShell title="Edit location" backTo="/dcim/locations" backLabel="Back to locations">
        <InlineLoader label="Loading location…" />
      </FormPageShell>
    );
  }
  if (!isNew && (detailQ.error || !initial)) {
    return (
      <FormPageShell title="Edit location" backTo="/dcim/locations" backLabel="Back to locations">
        <div className="error-banner">{detailQ.error ? String(detailQ.error) : "Not found"}</div>
      </FormPageShell>
    );
  }

  const refsLoading = typesQ.isLoading || locationsQ.isLoading || templatesQ.isLoading;
  if (refsLoading) {
    return (
      <FormPageShell
        title={isNew ? "New location" : "Edit location"}
        subtitle={isNew ? "Create a site or logical location in the hierarchy." : undefined}
        backTo="/dcim/locations"
        backLabel="Back to locations"
      >
        <InlineLoader label="Loading form options…" />
      </FormPageShell>
    );
  }

  const mutErr = createMut.error ?? patchMut.error;
  return (
    <LocationFormInner
      mode={isNew ? "create" : "edit"}
      initial={initial}
      locationTypes={typesQ.data?.items ?? []}
      locations={locationsQ.data?.items ?? []}
      templates={templatesQ.data?.items ?? []}
      submitting={createMut.isPending || patchMut.isPending}
      errorBanner={mutErr && !(mutErr instanceof ApiRequestError) ? String(mutErr) : null}
      serverValidationError={mutErr instanceof ApiRequestError ? mutErr : null}
      onCancel={() => navigate("/dcim/locations")}
      onSaveCreate={(body) => createMut.mutate(body)}
      onSaveEdit={
        id
          ? (body) => {
              patchMut.mutate({ id, body });
            }
          : undefined
      }
    />
  );
}

function LocationFormInner({
  mode,
  initial,
  locationTypes,
  locations,
  templates,
  submitting,
  errorBanner,
  serverValidationError,
  onCancel,
  onSaveCreate,
  onSaveEdit,
}: {
  mode: "create" | "edit";
  initial: LocationRow | null;
  locationTypes: LocationTypeOpt[];
  locations: LocationRow[];
  templates: TemplateOpt[];
  submitting: boolean;
  errorBanner: string | null;
  serverValidationError: ApiRequestError | null;
  onCancel: () => void;
  onSaveCreate: (body: Record<string, unknown>) => void;
  onSaveEdit: ((body: Record<string, unknown>) => void) | undefined;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [locationTypeId, setLocationTypeId] = useState(initial?.locationType?.id ?? locationTypes[0]?.id ?? "");
  const [parentId, setParentId] = useState(() => initial?.parent?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [templateId, setTemplateId] = useState(initial?.templateId ?? "");
  const [kv, setKv] = useState<Record<string, string>>(() =>
    initial?.customAttributes ? stringMapFromUnknown(initial.customAttributes) : {},
  );
  const [latStr, setLatStr] = useState(() =>
    initial?.latitude != null && !Number.isNaN(initial.latitude) ? String(initial.latitude) : "",
  );
  const [lonStr, setLonStr] = useState(() =>
    initial?.longitude != null && !Number.isNaN(initial.longitude) ? String(initial.longitude) : "",
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
    const tLat = latStr.trim();
    const tLon = lonStr.trim();
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (tLat || tLon) {
      const la = Number(tLat);
      const lo = Number(tLon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        return { ok: false, message: "Latitude and longitude must be valid numbers (or leave both empty)." };
      }
      if (la < -90 || la > 90) return { ok: false, message: "Latitude must be between -90 and 90." };
      if (lo < -180 || lo > 180) return { ok: false, message: "Longitude must be between -180 and 180." };
      latitude = la;
      longitude = lo;
    }
    return {
      ok: true,
      data: {
        name: name.trim(),
        slug: slug.trim(),
        locationTypeId,
        description: description.trim() || null,
        parentId: parentId || null,
        latitude,
        longitude,
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
    const v =
      mode === "create"
        ? validateLocationCreateBody(built.data)
        : validateLocationUpdateBody(built.data);
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

  const parentChoices = locations.filter((l) => !initial || l.id !== initial.id);

  const previewPoint = useMemo(() => {
    const tLat = latStr.trim();
    const tLon = lonStr.trim();
    if (tLat && tLon) {
      const la = Number(tLat);
      const lo = Number(tLon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
      return rowToMapPoint({
        id: initial?.id ?? "preview",
        name: name.trim() || initial?.name || "New location",
        latitude: la,
        longitude: lo,
      });
    }
    return null;
  }, [initial, latStr, lonStr, name]);

  const canSubmitAjv = useMemo(() => {
    const errs = computeClientFieldErrors();
    return Object.keys(errs).length === 0;
  }, [
    mode,
    name,
    slug,
    locationTypeId,
    parentId,
    description,
    templateId,
    kv,
    latStr,
    lonStr,
    templates,
  ]);

  return (
    <FormPageShell
      title={mode === "create" ? "New location" : "Edit location"}
      subtitle={mode === "create" ? "Create a site or logical location in the hierarchy." : undefined}
      backTo="/dcim/locations"
      backLabel="Back to locations"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="location-form"
            className="btn btn-primary"
            disabled={submitting || !canSubmitAjv}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        id="location-form"
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
            aria-invalid={fieldErr.name ? "true" : undefined}
            aria-errormessage={fieldErr.name ? "err-name" : undefined}
          />
          {fieldErr.name ? (
            <span id="err-name" className="muted" style={{ color: "var(--danger)" }}>
              {fieldErr.name}
            </span>
          ) : null}
        </label>
        <label>
          Slug
          <input
            className="input"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "slug")}
            autoComplete="off"
            aria-invalid={fieldErr.slug ? "true" : undefined}
          />
          {fieldErr.slug ? <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.slug}</span> : null}
        </label>
        <label>
          Location type
          <select
            className="input"
            value={locationTypeId}
            onChange={(e) => {
              setLocationTypeId(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "locationTypeId")}
            aria-invalid={fieldErr.locationTypeId ? "true" : undefined}
          >
            {locationTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {fieldErr.locationTypeId ? (
            <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.locationTypeId}</span>
          ) : null}
        </label>
        <label>
          Parent (optional)
          <select
            className="input"
            value={parentId}
            onChange={(e) => {
              setParentId(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "parentId")}
            aria-invalid={fieldErr.parentId ? "true" : undefined}
          >
            <option value="">— None —</option>
            {parentChoices.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {fieldErr.parentId ? (
            <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.parentId}</span>
          ) : null}
        </label>
        <label>
          Description
          <textarea
            className="input"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setServerFieldErr({});
            }}
            style={inputStyleForField(fieldErr, "description")}
            aria-invalid={fieldErr.description ? "true" : undefined}
          />
        </label>
        <div className="location-coords-block">
          <h3 className="location-coords-heading">Geographic coordinates</h3>
          <p className="muted">Optional. Set both to plot this location on maps (WGS84).</p>
          <div className="location-coords-grid">
            <label>
              Latitude
              <input
                className="input"
                inputMode="decimal"
                placeholder="e.g. 37.7749"
                value={latStr}
                onChange={(e) => {
                  setLatStr(e.target.value);
                  setServerFieldErr({});
                }}
                style={inputStyleForField(fieldErr, "latitude")}
                autoComplete="off"
                aria-invalid={fieldErr.latitude ? "true" : undefined}
              />
              {fieldErr.latitude ? (
                <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.latitude}</span>
              ) : null}
            </label>
            <label>
              Longitude
              <input
                className="input"
                inputMode="decimal"
                placeholder="e.g. -122.4194"
                value={lonStr}
                onChange={(e) => {
                  setLonStr(e.target.value);
                  setServerFieldErr({});
                }}
                style={inputStyleForField(fieldErr, "longitude")}
                autoComplete="off"
                aria-invalid={fieldErr.longitude ? "true" : undefined}
              />
              {fieldErr.longitude ? (
                <span className="muted" style={{ color: "var(--danger)" }}>{fieldErr.longitude}</span>
              ) : null}
            </label>
          </div>
          {previewPoint ? (
            <LocationMap points={[previewPoint]} height={260} highlightId={previewPoint.id} />
          ) : (
            <p className="muted">Enter a valid latitude and longitude pair to preview the map.</p>
          )}
        </div>
        <label>
          Template (optional)
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">— Default ({defaultTpl?.name ?? "none"}) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
                {t.isDefault ? " ★" : ""}
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
