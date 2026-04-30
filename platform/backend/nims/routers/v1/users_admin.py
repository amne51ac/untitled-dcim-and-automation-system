"""Org-scoped user management (interactive users) — admin only."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nims.auth_context import AuthContext, auth_actor_from_context, require_admin
from nims.crypto_util import hash_password_bcrypt
from nims.deps import get_auth, get_db, require_auth_ctx
from nims.models_generated import Apitokenrole, User, Userauthprovider
from nims.services.audit import record_audit
from nims.timeutil import utc_now

router = APIRouter(tags=["users"])


def _serialize_user(u: User) -> dict[str, object]:
    return {
        "id": str(u.id),
        "email": u.email,
        "displayName": u.displayName,
        "role": u.role.value,
        "isActive": u.isActive,
        "authProvider": u.authProvider.value,
        "updatedAt": u.updatedAt.isoformat() if u.updatedAt else None,
    }


def _active_admin_count(db: Session, organization_id: uuid.UUID) -> int:
    n = db.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.organizationId == organization_id,
            User.isActive.is_(True),
            User.role == Apitokenrole.ADMIN,
        )
    ).scalar_one()
    return int(n or 0)


def _ensure_not_last_admin(
    db: Session,
    organization_id: uuid.UUID,
    target: User,
    *,
    new_role: Apitokenrole | None = None,
    new_active: bool | None = None,
) -> None:
    """Block demotion or deactivation of the last active admin."""
    if target.role != Apitokenrole.ADMIN or not target.isActive:
        return
    will_stay_admin = (new_role is None or new_role == Apitokenrole.ADMIN) and (new_active is None or new_active)
    if will_stay_admin:
        return
    if _active_admin_count(db, organization_id) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove or demote the last active administrator for this organization",
        )


class UserCreateBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    displayName: str | None = Field(default=None, max_length=500)
    role: Literal["READ", "WRITE", "ADMIN"] = "READ"
    password: str | None = Field(default=None, min_length=8, max_length=256)


class UserPatchBody(BaseModel):
    displayName: str | None = None
    role: Literal["READ", "WRITE", "ADMIN"] | None = None
    isActive: bool | None = None


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
    q: str | None = Query(None, description="Filter by email (contains, case-insensitive)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict[str, object]:
    ctx = require_admin(require_auth_ctx(auth))
    org_id = ctx.organization.id
    stmt = select(User).where(User.organizationId == org_id)
    if q and q.strip():
        stmt = stmt.where(User.email.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(User.email.asc()).offset(offset).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_offset: int | None = (offset + limit) if has_more else None
    return {
        "items": [_serialize_user(u) for u in rows],
        "nextOffset": next_offset,
    }


@router.post("/users")
def create_user(
    body: UserCreateBody,
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_admin(require_auth_ctx(auth))
    org_id = ctx.organization.id
    email = body.email.strip().lower()
    exists = db.execute(
        select(User).where(User.organizationId == org_id, func.lower(User.email) == email)
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")
    role = Apitokenrole(body.role)
    pwd_hash: str | None = hash_password_bcrypt(body.password) if body.password else None
    if pwd_hash is None and role == Apitokenrole.ADMIN:
        # Admins should be able to sign in; require a password for new local admin unless we add invite flow.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required when creating an administrator account",
        )
    now = utc_now()
    u = User(
        id=uuid.uuid4(),
        organizationId=org_id,
        email=email,
        displayName=(body.displayName.strip() if body.displayName else None) or None,
        role=role,
        authProvider=Userauthprovider.LOCAL,
        passwordHash=pwd_hash,
        preferences={},
        isActive=True,
        createdAt=now,
        updatedAt=now,
    )
    db.add(u)
    record_audit(
        db,
        organization_id=org_id,
        actor=auth_actor_from_context(ctx),
        action="CREATE",
        resource_type="User",
        resource_id=str(u.id),
        after=_serialize_user(u),
    )
    db.commit()
    db.refresh(u)
    return _serialize_user(u)


@router.get("/users/{user_id}")
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_admin(require_auth_ctx(auth))
    u = db.execute(
        select(User).where(User.id == user_id, User.organizationId == ctx.organization.id)
    ).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_user(u)


@router.patch("/users/{user_id}")
def patch_user(
    user_id: uuid.UUID,
    body: UserPatchBody,
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, object]:
    ctx = require_admin(require_auth_ctx(auth))
    u = db.execute(
        select(User).where(User.id == user_id, User.organizationId == ctx.organization.id)
    ).scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    before = _serialize_user(u)
    new_role = Apitokenrole(body.role) if body.role is not None else None
    new_active = body.isActive

    if new_role is not None or new_active is not None:
        _ensure_not_last_admin(
            db,
            ctx.organization.id,
            u,
            new_role=new_role,
            new_active=new_active,
        )

    if body.displayName is not None:
        u.displayName = body.displayName.strip() or None
    if new_role is not None:
        u.role = new_role
    if new_active is not None:
        u.isActive = new_active
    u.updatedAt = utc_now()

    after = _serialize_user(u)
    record_audit(
        db,
        organization_id=ctx.organization.id,
        actor=auth_actor_from_context(ctx),
        action="UPDATE",
        resource_type="User",
        resource_id=str(u.id),
        before=before,
        after=after,
    )
    db.commit()
    db.refresh(u)
    return after
