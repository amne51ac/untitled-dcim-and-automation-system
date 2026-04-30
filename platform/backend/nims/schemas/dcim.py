"""Pydantic request/response body models for DCIM routes (single source of truth for API validation + OpenAPI)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator

from nims.schemas.common import NonEmptyName, SlugStr

DcimDeviceStatusLiteral = Literal["PLANNED", "STAGED", "ACTIVE", "DECOMMISSIONED"]


class LocationCreate(BaseModel):
    name: NonEmptyName
    slug: SlugStr
    locationTypeId: Annotated[
        uuid.UUID,
        Field(
            description="Reference to a `LocationType` row (global catalog).",
            json_schema_extra={"x-referential": "location_type", "x-validation-endpoint": "/v1/validation/location-type"},
        ),
    ]
    parentId: uuid.UUID | None = Field(
        default=None,
        description="Parent location in the org hierarchy, if any.",
        json_schema_extra={"x-referential": "location", "x-validation-endpoint": "/v1/validation/location"},
    )
    description: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90, description="WGS84; must be paired with longitude.")
    longitude: float | None = Field(
        default=None, ge=-180, le=180, description="WGS84; must be paired with latitude."
    )
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None

    @model_validator(mode="after")
    def lat_lon_both_or_neither(self) -> LocationCreate:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must both be set or both omitted")
        return self


class LocationUpdate(BaseModel):
    name: NonEmptyName | None = Field(default=None, description="Omit to leave unchanged.")
    slug: SlugStr | None = Field(default=None, description="Omit to leave unchanged.")
    locationTypeId: uuid.UUID | None = Field(
        default=None,
        description="`LocationType` id when changing the type.",
        json_schema_extra={"x-referential": "location_type", "x-validation-endpoint": "/v1/validation/location-type"},
    )
    parentId: uuid.UUID | None = Field(
        default=None,
        description="Re-parent within the org.",
        json_schema_extra={"x-referential": "location", "x-validation-endpoint": "/v1/validation/location"},
    )
    description: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None

    @model_validator(mode="after")
    def lat_lon_both_or_neither(self) -> LocationUpdate:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must both be set or both cleared")
        return self


class RackCreate(BaseModel):
    name: NonEmptyName
    locationId: Annotated[
        uuid.UUID,
        Field(
            description="Rack is placed in this org-scoped location.",
            json_schema_extra={"x-referential": "location", "x-validation-endpoint": "/v1/validation/location"},
        ),
    ]
    uHeight: int | None = Field(default=None, gt=0, description="Rack height in U; defaults to 42 on the server if omitted.")
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None


class RackUpdate(BaseModel):
    name: NonEmptyName | None = Field(default=None)
    locationId: uuid.UUID | None = Field(
        default=None,
        description="Relocate the rack to another site/room.",
        json_schema_extra={"x-referential": "location", "x-validation-endpoint": "/v1/validation/location"},
    )
    uHeight: int | None = Field(default=None, gt=0)
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None


class DeviceCreate(BaseModel):
    name: NonEmptyName
    deviceTypeId: Annotated[
        uuid.UUID,
        Field(
            description="`DeviceType` in the global catalog (manufacturer + model).",
            json_schema_extra={"x-referential": "device_type", "x-validation-endpoint": "/v1/validation/device-type"},
        ),
    ]
    deviceRoleId: Annotated[
        uuid.UUID,
        Field(
            description="`DeviceRole` in the global catalog.",
            json_schema_extra={"x-referential": "device_role", "x-validation-endpoint": "/v1/validation/device-role"},
        ),
    ]
    rackId: uuid.UUID | None = Field(
        default=None,
        description="Optional org-scoped rack placement.",
        json_schema_extra={"x-referential": "rack", "x-validation-endpoint": "/v1/validation/rack"},
    )
    serialNumber: str | None = None
    positionU: int | None = Field(default=None, ge=1, description="Rack unit position, when racked.")
    face: Literal["front", "rear"] | None = Field(default=None, description="Mount face when racked.")
    status: DcimDeviceStatusLiteral | None = Field(
        default=None, description="Lifecycle status; server defaults to PLANNED if omitted on create."
    )
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None


class DeviceUpdate(BaseModel):
    name: NonEmptyName | None = Field(default=None)
    deviceTypeId: uuid.UUID | None = Field(
        default=None,
        json_schema_extra={"x-referential": "device_type", "x-validation-endpoint": "/v1/validation/device-type"},
    )
    deviceRoleId: uuid.UUID | None = Field(
        default=None,
        json_schema_extra={"x-referential": "device_role", "x-validation-endpoint": "/v1/validation/device-role"},
    )
    rackId: uuid.UUID | None = Field(
        default=None,
        json_schema_extra={"x-referential": "rack", "x-validation-endpoint": "/v1/validation/rack"},
    )
    serialNumber: str | None = None
    positionU: int | None = Field(default=None, ge=1)
    face: Literal["front", "rear"] | None = None
    status: DcimDeviceStatusLiteral | None = None
    templateId: uuid.UUID | None = None
    customAttributes: dict[str, Any] | None = None


class InterfaceCreate(BaseModel):
    name: NonEmptyName
    type: str = "ethernet"
    macAddress: str | None = None
    mtu: int | None = None


class CableCreate(BaseModel):
    interfaceAId: uuid.UUID
    interfaceBId: uuid.UUID
    label: str | None = None

    @model_validator(mode="after")
    def distinct_interfaces(self) -> CableCreate:
        if self.interfaceAId == self.interfaceBId:
            raise ValueError("interfaceAId and interfaceBId must differ")
        return self
