import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

import cableCreate from "./pydantic-schemas/CableCreate.json";
import deviceCreate from "./pydantic-schemas/DeviceCreate.json";
import deviceUpdate from "./pydantic-schemas/DeviceUpdate.json";
import interfaceCreate from "./pydantic-schemas/InterfaceCreate.json";
import locationCreate from "./pydantic-schemas/LocationCreate.json";
import locationUpdate from "./pydantic-schemas/LocationUpdate.json";
import rackCreate from "./pydantic-schemas/RackCreate.json";
import rackUpdate from "./pydantic-schemas/RackUpdate.json";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const vLocationCreate = ajv.compile(locationCreate);
const vLocationUpdate = ajv.compile(locationUpdate);
const vRackCreate = ajv.compile(rackCreate);
const vRackUpdate = ajv.compile(rackUpdate);
const vDeviceCreate = ajv.compile(deviceCreate);
const vDeviceUpdate = ajv.compile(deviceUpdate);
const vInterfaceCreate = ajv.compile(interfaceCreate);
const vCableCreate = ajv.compile(cableCreate);

function run(
  validate: ReturnType<typeof ajv.compile>,
  data: unknown,
): { ok: true } | { ok: false; errors: ErrorObject[] } {
  const ok = validate(data) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: validate.errors ?? [] };
}

export function validateLocationCreateBody(data: unknown) {
  return run(vLocationCreate, data);
}

export function validateLocationUpdateBody(data: unknown) {
  return run(vLocationUpdate, data);
}

export function validateRackCreateBody(data: unknown) {
  return run(vRackCreate, data);
}

export function validateRackUpdateBody(data: unknown) {
  return run(vRackUpdate, data);
}

export function validateDeviceCreateBody(data: unknown) {
  return run(vDeviceCreate, data);
}

export function validateDeviceUpdateBody(data: unknown) {
  return run(vDeviceUpdate, data);
}

export function validateInterfaceCreateBody(data: unknown) {
  return run(vInterfaceCreate, data);
}

export function validateCableCreateBody(data: unknown) {
  return run(vCableCreate, data);
}

/** Map JSON Schema instance paths like `/name` or `/positionU` to a single form field key. */
export function ajvErrorsToFieldMap(errors: ErrorObject[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors) {
    const p = (e.instancePath || "/").replace(/^\//, "") || "_root";
    const key = p.split("/").filter(Boolean)[0] ?? "_root";
    const msg = e.message ? e.message : "Invalid value";
    if (!out[key]) out[key] = msg;
  }
  return out;
}
