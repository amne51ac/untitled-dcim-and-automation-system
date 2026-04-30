"""
Validate ResourceExtension.data (customAttributes) against ObjectTemplate.definition.

Custom fields are entries in definition["fields"] with ``builtin: false``. Supported keys per field:

- ``key`` (required): attribute name stored in ``customAttributes``.
- ``required`` (bool): must be present and not null.
- ``type``: ``string`` | ``number`` | ``integer`` | ``boolean`` | ``uuid`` | ``json`` (any JSON value).
- ``minLength`` / ``maxLength`` (strings).
- ``minimum`` / ``maximum`` (numbers).
- ``pattern``: regex, matched with ``re.fullmatch`` against the string form of the value.
- ``enum`` or ``options``: list of allowed values (compared after normalizing type).

Template-level:

- ``strictCustomAttributes`` (bool): if true, only keys listed in custom field specs may appear in ``customAttributes``.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from nims.models_generated import ObjectTemplate

_MISSING = object()


def fetch_template_for_extension(
    db: Session,
    organization_id: uuid.UUID,
    resource_type: str,
    template_id: uuid.UUID | None,
) -> ObjectTemplate | None:
    """Resolved template row for validation context (explicit id or org default for resource type)."""
    if template_id is not None:
        return db.execute(
            select(ObjectTemplate).where(
                and_(
                    ObjectTemplate.id == template_id,
                    ObjectTemplate.organizationId == organization_id,
                    ObjectTemplate.resourceType == resource_type,
                ),
            ),
        ).scalar_one_or_none()
    return db.execute(
        select(ObjectTemplate).where(
            and_(
                ObjectTemplate.organizationId == organization_id,
                ObjectTemplate.resourceType == resource_type,
                ObjectTemplate.isDefault.is_(True),
            ),
        ),
    ).scalar_one_or_none()


def _custom_field_specs(definition: dict[str, Any]) -> list[dict[str, Any]]:
    fields = definition.get("fields")
    if not isinstance(fields, list):
        return []
    out: list[dict[str, Any]] = []
    for f in fields:
        if isinstance(f, dict) and f.get("builtin") is False:
            out.append(f)
    return out


def build_custom_attributes_json_schema(definition: dict[str, Any]) -> dict[str, Any] | None:
    """
    JSON Schema (draft 2020-12 style) for customAttributes object, or None if no rules apply.
    Used by GET /templates/{id} and optional client-side Ajv validation.
    """
    specs = _custom_field_specs(definition)
    strict = bool(definition.get("strictCustomAttributes"))
    if not specs and not strict:
        return None

    properties: dict[str, Any] = {}
    required_keys: list[str] = []

    for spec in specs:
        key = spec.get("key") or spec.get("apiKey")
        if not key or not isinstance(key, str):
            continue
        t = str(spec.get("type") or "string").lower()
        prop: dict[str, Any] = {}
        if t in ("string", "textarea"):
            prop["type"] = ["string", "null"]
            if spec.get("minLength") is not None:
                prop["minLength"] = int(spec["minLength"])
            if spec.get("maxLength") is not None:
                prop["maxLength"] = int(spec["maxLength"])
            if spec.get("pattern"):
                prop["pattern"] = str(spec["pattern"])
        elif t == "number":
            prop["type"] = ["number", "null"]
        elif t in ("integer", "int"):
            prop["type"] = ["integer", "null"]
        elif t == "boolean":
            prop["type"] = ["boolean", "null"]
        elif t == "uuid":
            prop["type"] = ["string", "null"]
            prop["format"] = "uuid"
        elif t == "json":
            prop = {}  # any
        else:
            prop["type"] = ["string", "null"]

        opts = spec.get("enum") if isinstance(spec.get("enum"), list) else spec.get("options")
        if isinstance(opts, list) and opts:
            prop["enum"] = list(opts)
            if not spec.get("required"):
                prop["enum"] = list(opts) + [None]

        if spec.get("minimum") is not None:
            prop["minimum"] = spec["minimum"]
        if spec.get("maximum") is not None:
            prop["maximum"] = spec["maximum"]

        properties[key] = prop
        if spec.get("required"):
            required_keys.append(key)

    schema: dict[str, Any] = {
        "type": "object",
        "properties": properties,
        "additionalProperties": not strict,
    }
    if required_keys:
        schema["required"] = required_keys
    if strict and not specs:
        schema["maxProperties"] = 0
    return schema


def _issue(field_key: str | None, msg: str, code: str = "invalid.custom_attribute") -> dict[str, Any]:
    loc: list[str | int] = ["body", "customAttributes"]
    if field_key is not None:
        loc.append(field_key)
    return {"type": "value_error", "loc": loc, "msg": msg, "code": code}


def collect_custom_attribute_validation_errors(
    data: dict[str, Any],
    definition: dict[str, Any],
) -> list[dict[str, Any]]:
    """Pure validation of ``customAttributes`` payload against a template ``definition`` document."""
    specs = _custom_field_specs(definition)
    strict = bool(definition.get("strictCustomAttributes"))

    allowed_keys: set[str] = set()
    for spec in specs:
        k = spec.get("key") or spec.get("apiKey")
        if isinstance(k, str) and k:
            allowed_keys.add(k)

    errors: list[dict[str, Any]] = []

    if strict:
        if not allowed_keys and data:
            errors.append(_issue(None, "This template does not allow custom attributes.", "custom_attributes.forbidden"))
        else:
            for dk in data:
                if dk not in allowed_keys:
                    errors.append(_issue(dk, f"Unknown custom attribute key: {dk}", "custom_attributes.unknown_key"))

    for spec in specs:
        key = spec.get("key") or spec.get("apiKey")
        if not isinstance(key, str) or not key:
            continue
        required = bool(spec.get("required"))
        val = data.get(key, _MISSING)

        if required:
            if val is _MISSING or val is None:
                errors.append(_issue(key, f"Missing required custom attribute: {key}", "custom_attribute.missing"))
                continue
            if isinstance(val, str) and not val.strip():
                errors.append(_issue(key, f"Required custom attribute {key} cannot be empty", "custom_attribute.empty"))
                continue

        if val is _MISSING or val is None:
            continue

        t = str(spec.get("type") or "string").lower()

        if t in ("string", "textarea"):
            if not isinstance(val, str):
                errors.append(_issue(key, f"{key} must be a string", "custom_attribute.type"))
                continue
            if spec.get("minLength") is not None and len(val) < int(spec["minLength"]):
                errors.append(_issue(key, f"{key} is shorter than minLength", "custom_attribute.min_length"))
            if spec.get("maxLength") is not None and len(val) > int(spec["maxLength"]):
                errors.append(_issue(key, f"{key} exceeds maxLength", "custom_attribute.max_length"))
            pat = spec.get("pattern")
            if pat:
                try:
                    if not re.fullmatch(str(pat), val):
                        errors.append(_issue(key, f"{key} does not match required pattern", "custom_attribute.pattern"))
                except re.error:
                    errors.append(_issue(key, f"Invalid pattern in template for {key}", "template.invalid_pattern"))

        elif t == "number":
            if not isinstance(val, bool) and not isinstance(val, (int, float)):
                errors.append(_issue(key, f"{key} must be a number", "custom_attribute.type"))
                continue
            if isinstance(val, bool):
                errors.append(_issue(key, f"{key} must be a number", "custom_attribute.type"))
                continue
            n = float(val)
            if spec.get("minimum") is not None and n < float(spec["minimum"]):
                errors.append(_issue(key, f"{key} is below minimum", "custom_attribute.minimum"))
            if spec.get("maximum") is not None and n > float(spec["maximum"]):
                errors.append(_issue(key, f"{key} is above maximum", "custom_attribute.maximum"))

        elif t in ("integer", "int"):
            if isinstance(val, bool):
                errors.append(_issue(key, f"{key} must be an integer", "custom_attribute.type"))
                continue
            iv: int
            if isinstance(val, int):
                iv = val
            elif isinstance(val, float) and val.is_integer():
                iv = int(val)
            else:
                errors.append(_issue(key, f"{key} must be an integer", "custom_attribute.type"))
                continue
            if spec.get("minimum") is not None and iv < int(spec["minimum"]):
                errors.append(_issue(key, f"{key} is below minimum", "custom_attribute.minimum"))
            if spec.get("maximum") is not None and iv > int(spec["maximum"]):
                errors.append(_issue(key, f"{key} is above maximum", "custom_attribute.maximum"))

        elif t == "boolean":
            if not isinstance(val, bool):
                errors.append(_issue(key, f"{key} must be a boolean", "custom_attribute.type"))

        elif t == "uuid":
            try:
                uuid.UUID(str(val))
            except (ValueError, TypeError):
                errors.append(_issue(key, f"{key} must be a UUID", "custom_attribute.uuid"))

        elif t == "json":
            pass

        opts = spec.get("enum") if isinstance(spec.get("enum"), list) else spec.get("options")
        if isinstance(opts, list) and opts:
            if val not in opts:
                errors.append(_issue(key, f"{key} must be one of the allowed values", "custom_attribute.enum"))

    return errors


def validate_custom_attributes_for_storage(
    db: Session,
    organization_id: uuid.UUID,
    resource_type: str,
    template_id: uuid.UUID | None,
    data: dict[str, Any],
) -> None:
    """
    Raise HTTPException(400) with structured detail when customAttributes violate the template definition.
    No-op when data is empty or no applicable template / rules.
    """
    if not data:
        return

    row = fetch_template_for_extension(db, organization_id, resource_type, template_id)
    if row is None:
        return

    definition = row.definition if isinstance(row.definition, dict) else {}
    errors = collect_custom_attribute_validation_errors(data, definition)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)


def augment_template_item_with_validation_schema(item: dict[str, Any]) -> dict[str, Any]:
    """Attach ``customAttributesJsonSchema`` when derivable from ``definition``."""
    out = dict(item)
    definition = out.get("definition")
    if not isinstance(definition, dict):
        return out
    schema = build_custom_attributes_json_schema(definition)
    if schema is not None:
        out["customAttributesJsonSchema"] = schema
    return out
