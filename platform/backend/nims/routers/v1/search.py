"""Cross-resource search (substring match across searchable columns on org-visible inventory objects)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from nims.auth_context import AuthContext
from nims.deps import get_auth, get_db, require_auth_ctx
from nims.services.global_search import global_search_items

router = APIRouter(tags=["search"])


@router.get("/search")
def global_search(
    q: str = Query("", min_length=0, max_length=200),
    limit: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    auth: Annotated[AuthContext | None, Depends(get_auth)] = None,
) -> dict[str, list[dict[str, Any]]]:
    ctx = require_auth_ctx(auth)
    items = global_search_items(db, ctx.organization.id, q, limit)
    return {"items": items}
