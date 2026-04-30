"""Authoritative referential (FK-style) checks for DCIM mutating operations."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from nims.models_generated import (
    DeviceRole,
    DeviceType,
    Interface,
    Location,
    LocationType,
    Rack,
)
from nims.schemas.dcim import DeviceCreate, DeviceUpdate, LocationCreate, LocationUpdate, RackCreate, RackUpdate


def _validation_error(
    field: str,
    code: str,
    message: str,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=[
            {
                "type": "value_error",
                "loc": ["body", field],
                "msg": message,
                "code": code,
            }
        ],
    )


def assert_location_type_exists(db: Session, location_type_id: uuid.UUID) -> None:
    row = db.execute(select(LocationType).where(LocationType.id == location_type_id)).scalar_one_or_none()
    if row is None:
        raise _validation_error("locationTypeId", "not_found.location_type", "Location type was not found")


def assert_location_in_org(
    db: Session,
    organization_id: uuid.UUID,
    location_id: uuid.UUID,
    *,
    field: str = "locationId",
    code: str = "not_found.location",
) -> None:
    row = db.execute(
        select(Location).where(
            and_(
                Location.id == location_id,
                Location.organizationId == organization_id,
                Location.deletedAt.is_(None),
            ),
        ),
    ).scalar_one_or_none()
    if row is None:
        raise _validation_error(field, code, "Location was not found in this organization")


def assert_rack_in_org(
    db: Session,
    organization_id: uuid.UUID,
    rack_id: uuid.UUID,
    field: str = "rackId",
) -> None:
    row = db.execute(
        select(Rack).where(
            and_(
                Rack.id == rack_id,
                Rack.organizationId == organization_id,
                Rack.deletedAt.is_(None),
            ),
        ),
    ).scalar_one_or_none()
    if row is None:
        raise _validation_error(field, "not_found.rack", "Rack was not found in this organization")


def assert_device_type_exists(db: Session, device_type_id: uuid.UUID) -> None:
    row = db.execute(select(DeviceType).where(DeviceType.id == device_type_id)).scalar_one_or_none()
    if row is None:
        raise _validation_error("deviceTypeId", "not_found.device_type", "Device type was not found")


def assert_device_role_exists(db: Session, device_role_id: uuid.UUID) -> None:
    row = db.execute(select(DeviceRole).where(DeviceRole.id == device_role_id)).scalar_one_or_none()
    if row is None:
        raise _validation_error("deviceRoleId", "not_found.device_role", "Device role was not found")


def validate_location_create_fks(
    db: Session,
    organization_id: uuid.UUID,
    body: LocationCreate,
) -> None:
    assert_location_type_exists(db, body.locationTypeId)
    if body.parentId is not None:
        assert_location_in_org(
            db,
            organization_id,
            body.parentId,
            field="parentId",
            code="not_found.parent_location",
        )


def validate_location_update_fks(
    db: Session,
    organization_id: uuid.UUID,
    location_id: uuid.UUID,
    body: LocationUpdate,
) -> None:
    raw = body.model_dump(exclude_unset=True)
    if "locationTypeId" in raw and raw["locationTypeId"] is not None:
        assert_location_type_exists(db, raw["locationTypeId"])
    if "parentId" in raw and raw["parentId"] is not None:
        assert_location_in_org(
            db,
            organization_id,
            raw["parentId"],
            field="parentId",
            code="not_found.parent_location",
        )
        if raw["parentId"] == location_id:
            raise _validation_error("parentId", "invalid.hierarchy", "Location cannot be its own parent")


def validate_rack_create_fks(db: Session, organization_id: uuid.UUID, body: RackCreate) -> None:
    assert_location_in_org(db, organization_id, body.locationId, field="locationId")


def validate_rack_update_fks(
    db: Session,
    organization_id: uuid.UUID,
    body: RackUpdate,
) -> None:
    raw = body.model_dump(exclude_unset=True)
    if "locationId" in raw and raw["locationId"] is not None:
        assert_location_in_org(db, organization_id, raw["locationId"], field="locationId")


def validate_device_create_fks(
    db: Session,
    organization_id: uuid.UUID,
    body: DeviceCreate,
) -> None:
    assert_device_type_exists(db, body.deviceTypeId)
    assert_device_role_exists(db, body.deviceRoleId)
    if body.rackId is not None:
        assert_rack_in_org(db, organization_id, body.rackId)


def validate_device_update_fks(
    db: Session,
    organization_id: uuid.UUID,
    body: DeviceUpdate,
) -> None:
    raw = body.model_dump(exclude_unset=True)
    if "deviceTypeId" in raw and raw["deviceTypeId"] is not None:
        assert_device_type_exists(db, raw["deviceTypeId"])
    if "deviceRoleId" in raw and raw["deviceRoleId"] is not None:
        assert_device_role_exists(db, raw["deviceRoleId"])
    if "rackId" in raw and raw["rackId"] is not None:
        assert_rack_in_org(db, organization_id, raw["rackId"])


def validate_cable_interfaces_in_org(
    db: Session,
    organization_id: uuid.UUID,
    interface_a_id: uuid.UUID,
    interface_b_id: uuid.UUID,
) -> None:
    ia = (
        db.execute(
            select(Interface)
            .options(joinedload(Interface.Device_))
            .where(Interface.id == interface_a_id, Interface.deletedAt.is_(None)),
        )
        .unique()
        .scalar_one_or_none()
    )
    ib = (
        db.execute(
            select(Interface)
            .options(joinedload(Interface.Device_))
            .where(Interface.id == interface_b_id, Interface.deletedAt.is_(None)),
        )
        .unique()
        .scalar_one_or_none()
    )
    for iface, name in ((ia, "interfaceAId"), (ib, "interfaceBId")):
        if iface is None or iface.Device_ is None:
            raise _validation_error(
                name,
                "not_found.interface",
                "Interface was not found (or is deleted).",
            )
        if (
            iface.Device_.organizationId != organization_id
            or iface.Device_.deletedAt is not None
        ):
            raise _validation_error(
                name,
                "not_found.interface",
                "Interface is not in this organization.",
            )
