"""Organization identity: local + at most one external IdP (admin only)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from nims.auth_context import AuthContext, auth_actor_from_context, require_admin
from nims.deps import get_auth, get_db, require_auth_ctx
from nims.models_generated import Organization
from nims.services.audit import record_audit
from nims.services.identity_connection_test import run_identity_test
from nims.services.identity_settings import apply_admin_patch, build_admin_response

router = APIRouter(tags=["admin", "identity"])


def _get_org_by_id(db: Session, org_id: uuid.UUID) -> Organization:
    o = db.get(Organization, org_id)
    if o is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Organization not found; cannot load identity settings.",
        )
    return o


class IdentityTestRequest(BaseModel):
    target: Literal["ldap", "azure_ad", "oidc"] = Field(
        description="Directory to probe: bind for LDAP, OpenID metadata for Entra and OIDC.",
    )
    overrides: dict[str, str] | None = Field(
        default=None,
        description="Unsaved form values (same key names as PATCH for that provider; merged with stored when not "
        "env-locked).",
    )


@router.get("/admin/identity")
def get_admin_identity(
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, Any]:
    """Effective identity for the signed-in org (env overrides; secrets never in plaintext in JSON for sensitive fields)."""
    ctx = require_admin(require_auth_ctx(auth))
    org = _get_org_by_id(db, ctx.organization.id)
    return build_admin_response(org)


@router.post("/admin/identity/test")
def post_admin_identity_test(
    body: IdentityTestRequest,
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, str | bool]:
    """Test LDAP bind or fetch OpenID metadata for the selected directory (admin only; does not persist)."""
    ctx = require_admin(require_auth_ctx(auth))
    org = _get_org_by_id(db, ctx.organization.id)
    ok, message = run_identity_test(
        org,
        body.target,
        body.overrides,
    )
    return {"ok": ok, "message": message}


@router.patch("/admin/identity")
def patch_admin_identity(
    body: Annotated[dict[str, Any], Body(...)],
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, Any]:
    ctx = require_admin(require_auth_ctx(auth))
    org = _get_org_by_id(db, ctx.organization.id)
    apply_admin_patch(org, body)
    # SQLAlchemy in-place JSON mutation
    try:
        flag_modified(org, "identityConfig")
    except (AttributeError, TypeError, ValueError):
        pass
    record_audit(
        db,
        organization_id=ctx.organization.id,
        actor=auth_actor_from_context(ctx),
        action="UPDATE",
        resource_type="Organization",
        resource_id=str(org.id),
        after={"field": "identityConfig", "keysTouched": sorted(body.keys())},
    )
    db.commit()
    return build_admin_response(org)
