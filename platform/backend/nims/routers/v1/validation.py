"""Async-friendly referential checks for the operator console (complements cache-based validation)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from nims.auth_context import AuthContext
from nims.deps import get_auth, get_db, require_auth_ctx
from nims.models_generated import DeviceRole, DeviceType, Interface, Location, LocationType, Rack
from nims.services.dcim_referential import validate_cable_interfaces_in_org

router = APIRouter(
    tags=["validation"],
    prefix="/validation",
)


@router.get("/location-type")
def validate_location_type(
    id: uuid.UUID = Query(..., description="`LocationType.id` in the global catalog"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    _ = require_auth_ctx(auth)
    row = db.execute(select(LocationType).where(LocationType.id == id)).scalar_one_or_none()
    if row is None:
        return {"valid": False, "id": str(id), "code": "not_found.location_type"}
    return {
        "valid": True,
        "id": str(row.id),
        "name": row.name,
        "label": row.name,
    }


@router.get("/location")
def validate_location(
    id: uuid.UUID = Query(..., description="Org-scoped `Location.id`"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_auth_ctx(auth)
    row = (
        db.execute(
            select(Location)
            .where(
                and_(
                    Location.id == id,
                    Location.organizationId == ctx.organization.id,
                    Location.deletedAt.is_(None),
                )
            )
            .options(joinedload(Location.LocationType_))
        )
        .unique()
        .scalar_one_or_none()
    )
    if row is None:
        return {"valid": False, "id": str(id), "code": "not_found.location"}
    return {
        "valid": True,
        "id": str(row.id),
        "name": row.name,
        "label": row.name,
    }


@router.get("/rack")
def validate_rack(
    id: uuid.UUID = Query(..., description="Org-scoped `Rack.id`"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_auth_ctx(auth)
    row = (
        db.execute(
            select(Rack).where(
                and_(
                    Rack.id == id,
                    Rack.organizationId == ctx.organization.id,
                    Rack.deletedAt.is_(None),
                )
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if row is None:
        return {"valid": False, "id": str(id), "code": "not_found.rack"}
    return {
        "valid": True,
        "id": str(row.id),
        "name": row.name,
        "label": row.name,
    }


@router.get("/device-type")
def validate_device_type(
    id: uuid.UUID = Query(..., description="`DeviceType.id` in the global catalog"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    _ = require_auth_ctx(auth)
    row = (
        db.execute(select(DeviceType).options(joinedload(DeviceType.Manufacturer_)).where(DeviceType.id == id))
        .unique()
        .scalar_one_or_none()
    )
    if row is None:
        return {"valid": False, "id": str(id), "code": "not_found.device_type"}
    mfg = row.Manufacturer_.name if row.Manufacturer_ else "?"
    model = row.model
    return {
        "valid": True,
        "id": str(row.id),
        "name": f"{mfg} {model}",
        "manufacturer": mfg,
        "model": model,
        "label": f"{mfg} {model}",
    }


@router.get("/device-role")
def validate_device_role(
    id: uuid.UUID = Query(..., description="`DeviceRole.id` in the global catalog"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    _ = require_auth_ctx(auth)
    row = db.execute(select(DeviceRole).where(DeviceRole.id == id)).scalar_one_or_none()
    if row is None:
        return {"valid": False, "id": str(id), "code": "not_found.device_role"}
    return {"valid": True, "id": str(row.id), "name": row.name, "label": row.name}


@router.get("/interface")
def validate_interface(
    id: uuid.UUID = Query(..., description="Interface id (must belong to a device in your org)"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_auth_ctx(auth)
    iface = (
        db.execute(
            select(Interface)
            .options(joinedload(Interface.Device_))
            .where(Interface.id == id, Interface.deletedAt.is_(None)),
        )
        .unique()
        .scalar_one_or_none()
    )
    if (
        iface is None
        or iface.Device_ is None
        or iface.Device_.organizationId != ctx.organization.id
        or iface.Device_.deletedAt is not None
    ):
        return {"valid": False, "id": str(id), "code": "not_found.interface"}
    return {
        "valid": True,
        "id": str(iface.id),
        "name": iface.name,
        "label": f"{iface.Device_.name} — {iface.name}",
    }


@router.get("/cable-ends")
def validate_cable_endpoints(
    interfaceAId: uuid.UUID = Query(..., alias="interfaceAId"),
    interfaceBId: uuid.UUID = Query(..., alias="interfaceBId"),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    """
    Check both cable endpoints in one round trip (org scope + interface existence).
    """
    ctx = require_auth_ctx(auth)
    try:
        validate_cable_interfaces_in_org(db, ctx.organization.id, interfaceAId, interfaceBId)
    except HTTPException as e:
        code = "not_found.interface"
        if isinstance(e.detail, list) and e.detail and isinstance(e.detail[0], dict):
            c = e.detail[0].get("code")
            if isinstance(c, str):
                code = c
        return {"valid": False, "code": code, "interfaceAId": str(interfaceAId), "interfaceBId": str(interfaceBId)}

    return {
        "valid": True,
        "interfaceAId": str(interfaceAId),
        "interfaceBId": str(interfaceBId),
    }
