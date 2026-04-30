"""Global search: substring match across all searchable scalar columns, org-scoped like the inventory catalog (see search_scoped_select in catalog_io)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import BooleanClauseList, ColumnElement
from sqlalchemy.types import LargeBinary

from nims.services.catalog_io import (
    CATALOG_TYPES,
    SEARCH_EXTRA_MODELS,
    search_scoped_select,
)

# Types shown first in round-robin; remaining catalog types follow alphabetically.
_PRIORITY_RT = [
    "Device",
    "Location",
    "Rack",
    "Vrf",
    "Interface",
    "Prefix",
    "IpAddress",
    "Circuit",
    "Vlan",
    "Provider",
    "ServiceInstance",
    "Project",
    "Cable",
    "JobDefinition",
    "JobRun",
    "ObjectTemplate",
    "ChangeRequest",
]


def _all_search_types() -> list[str]:
    base = (CATALOG_TYPES - {"Tenant"}) | set(SEARCH_EXTRA_MODELS)
    first = [x for x in _PRIORITY_RT if x in base]
    rest = sorted(base - set(first), key=str.lower)
    return first + rest


def _path_for(rt: str, rid: str) -> str:
    return f"/o/{rt}/{rid}"


def _skip_column_name(name: str) -> bool:
    n = name.lower()
    if n in {
        "passwordhash",
        "tokenhash",
        "llmconfig",
        "identityconfig",
    }:
        return True
    if n.endswith("enc") or n.endswith("encrypted"):
        return True
    if "secret" in n:
        return True
    for sub in ("password", "apikey", "refreshtoken", "accesstoken", "credentials"):
        if sub in n:
            return True
    return False


def _ilike_clauses_for_model(model_cls: type, pat: str) -> BooleanClauseList | None:
    clauses: list[ColumnElement[Any]] = []
    for c in model_cls.__table__.columns:
        if _skip_column_name(c.name):
            continue
        if isinstance(c.type, LargeBinary):
            continue
        if getattr(c.type, "python_type", None) is type(None):
            # skip unusual types; cast handles most
            pass
        try:
            clauses.append(cast(c, String).ilike(pat))
        except (NotImplementedError, AttributeError, TypeError):
            continue
    if not clauses:
        return None
    return or_(*clauses)


def _label_for_row(inst: Any) -> str:
    for k in (
        "name",
        "key",
        "title",
        "cid",
        "cidr",
        "address",
        "version",
        "slug",
    ):
        v = getattr(inst, k, None)
        if v is not None and str(v).strip():
            return str(v)[:200]
    return str(getattr(inst, "id", ""))[:64]


def _subtitle_for_row(inst: Any) -> str | None:
    for k in (
        "serialNumber",
        "rd",
        "description",
    ):
        v = getattr(inst, k, None)
        if v is not None and str(v).strip():
            t = str(v)
            if len(t) > 200:
                return t[:200] + "…"
            return t
    return None


def global_search_items(
    db: Session,
    organization_id: uuid.UUID,
    q: str,
    limit: int = 15,
) -> list[dict[str, Any]]:
    term = (q or "").strip()
    if not term:
        return []
    # User text is not treated as SQL wildcards (ILIKE would interpret % and _).
    clean = term.replace("%", "").replace("_", "")
    if not clean:
        return []
    pat = f"%{clean}%"

    out: list[dict[str, Any]] = []
    rts = _all_search_types()
    prepared: list[tuple[str, Any, type, BooleanClauseList]] = []
    for rt in rts:
        scoped = search_scoped_select(db, organization_id, rt)
        if not scoped:
            continue
        qbase, main_model = scoped
        like = _ilike_clauses_for_model(main_model, pat)
        if like is None:
            continue
        prepared.append((rt, qbase, main_model, like))

    next_k: dict[str, int] = {rt: 0 for rt, _, _, _ in prepared}
    done: set[str] = set()

    while len(out) < limit:
        any_hit = False
        for rt, qbase, main_model, like in prepared:
            if len(out) >= limit:
                break
            if rt in done:
                continue
            k = next_k[rt]
            stmt = qbase.where(like).order_by(main_model.id.asc())
            row = db.execute(stmt.offset(k).limit(1)).scalars().first()
            if row is not None:
                any_hit = True
                next_k[rt] = k + 1
                lab = _label_for_row(row)
                sub = _subtitle_for_row(row)
                d: dict[str, Any] = {
                    "resourceType": rt,
                    "id": str(row.id),  # type: ignore[union-attr]
                    "label": lab,
                    "path": _path_for(rt, str(row.id)),  # type: ignore[union-attr]
                }
                if sub:
                    d["subtitle"] = sub
                out.append(d)
            else:
                if k == 0:
                    done.add(rt)
                else:
                    done.add(rt)
        if not any_hit:
            break

    return out[:limit]
