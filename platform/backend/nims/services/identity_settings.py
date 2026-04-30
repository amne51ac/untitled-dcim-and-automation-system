"""
Merged identity (local + at most one of LDAP, Entra, OIDC) from environment and Organization.identityConfig.
Environment overrides storage. Secrets in the DB are Fernet-encrypted; never sent to the client in plaintext.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from nims.identity_crypto import pack_encrypted, unpack_encrypted
from nims.models_generated import Organization
from nims.timeutil import utc_now

ENV_LOCK_MSG = "Settings configured at the environment level can not be changed within the interface"

SENS = True
OPEN = False


def _env_raw(key: str) -> str | None:
    v = os.environ.get(key)
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _env_set(key: str) -> bool:
    return _env_raw(key) is not None


def _env_bool(key: str) -> bool | None:
    v = _env_raw(key)
    if v is None:
        return None
    return v.lower() in ("1", "true", "yes", "on")


def _get_storage(org: Organization) -> dict[str, Any]:
    raw = org.identityConfig
    if isinstance(raw, dict):
        return dict(raw)
    return {}


def _ext_normalize(v: str | None) -> str:
    if not v:
        return "none"
    s = v.lower().strip()
    if s in ("", "off", "disabled", "none", "local"):
        return "none"
    if s in ("azure", "azuread", "entra", "microsoft"):
        s = "azure_ad"
    if s in ("ldap", "azure_ad", "oidc", "none"):
        return s
    return "none"


def _effective_local_enabled(st: dict[str, Any]) -> bool:
    b = _env_bool("AUTH_LOCAL_ENABLED")
    if b is not None:
        return b
    v = st.get("localEnabled")
    if isinstance(v, bool):
        return v
    return True


def _effective_external_provider(st: dict[str, Any]) -> str:
    e = _env_raw("AUTH_EXTERNAL_PROVIDER")
    if e is not None:
        return _ext_normalize(e)
    v = st.get("externalProvider")
    if isinstance(v, str):
        return _ext_normalize(v)
    return "none"


def get_first_organization(db: Session) -> Organization | None:
    return db.execute(select(Organization).order_by(Organization.createdAt.asc()).limit(1)).scalar_one_or_none()


def get_effective_identity_dict(st: dict[str, Any]) -> dict[str, Any]:
    return {
        "localEnabled": _effective_local_enabled(st),
        "externalProvider": _effective_external_provider(st),
    }


def _field(
    name: str,
    *,
    value_storage: Any,
    enc_storage: str | None,
    env_name: str,
    sensitive: bool,
) -> dict[str, Any]:
    if _env_set(env_name):
        if sensitive:
            return {
                "name": name,
                "value": None,
                "display": "****",
                "source": "environment",
                "locked": True,
                "sensitive": True,
            }
        return {
            "name": name,
            "value": _env_raw(env_name),
            "display": _env_raw(env_name),
            "source": "environment",
            "locked": True,
            "sensitive": False,
        }
    if sensitive and enc_storage:
        ok = bool(unpack_encrypted(enc_storage) or (isinstance(enc_storage, str) and enc_storage.startswith("f1:")))
        return {
            "name": name,
            "value": None,
            "display": "****" if ok else None,
            "source": "storage",
            "locked": False,
            "sensitive": True,
            "configured": ok,
        }
    if sensitive and not enc_storage:
        return {
            "name": name,
            "value": None,
            "display": None,
            "source": "storage",
            "locked": False,
            "sensitive": True,
            "configured": False,
        }
    return {
        "name": name,
        "value": value_storage,
        "display": value_storage,
        "source": "storage",
        "locked": False,
        "sensitive": False,
    }


_IDP_ENV_KEYS = (
    "AUTH_LOCAL_ENABLED",
    "AUTH_EXTERNAL_PROVIDER",
    "AUTH_LDAP_URL",
    "AUTH_LDAP_BIND_DN",
    "AUTH_LDAP_BIND_PASSWORD",
    "AUTH_LDAP_USER_SEARCH_BASE",
    "AUTH_LDAP_USER_SEARCH_FILTER",
    "AUTH_AZURE_TENANT_ID",
    "AUTH_AZURE_CLIENT_ID",
    "AUTH_AZURE_CLIENT_SECRET",
    "AUTH_OIDC_ISSUER",
    "AUTH_OIDC_CLIENT_ID",
    "AUTH_OIDC_CLIENT_SECRET",
    "AUTH_OIDC_REDIRECT_URI",
)


def build_admin_response(org: Organization) -> dict[str, Any]:
    st = _get_storage(org)
    any_env_lock = any(_env_set(k) for k in _IDP_ENV_KEYS)
    ldap = st.get("ldap") if isinstance(st.get("ldap"), dict) else {}
    az = st.get("azure") if isinstance(st.get("azure"), dict) else {}
    oi = st.get("oidc") if isinstance(st.get("oidc"), dict) else {}

    local_on = "AUTH_LOCAL_ENABLED"
    ext_p = "AUTH_EXTERNAL_PROVIDER"
    le = _field(
        "localEnabled",
        value_storage=bool(st.get("localEnabled", True)),
        enc_storage=None,
        env_name=local_on,
        sensitive=OPEN,
    )
    ex = _field(
        "externalProvider",
        value_storage=_ext_normalize(str(st.get("externalProvider", "none") or "none")),
        enc_storage=None,
        env_name=ext_p,
        sensitive=OPEN,
    )
    if _env_set(local_on):
        b = _env_bool(local_on)
        le = {
            "name": "localEnabled",
            "value": bool(b) if b is not None else False,
            "display": "true" if b else "false",
            "source": "environment",
            "locked": True,
            "sensitive": False,
        }
    if _env_set(ext_p):
        e = _ext_normalize(_env_raw(ext_p) or "none")
        ex = {
            "name": "externalProvider",
            "value": e,
            "display": e,
            "source": "environment",
            "locked": True,
            "sensitive": False,
        }

    return {
        "message": ENV_LOCK_MSG,
        "local": le,
        "external": ex,
        "help": "Only one external type (LDAP, Microsoft Entra, or OIDC) can be active. Basic (email/password) is independent and may be on together with one IdP.",
        "ldap": {
            "url": _field("url", value_storage=ldap.get("url"), enc_storage=None, env_name="AUTH_LDAP_URL", sensitive=OPEN),
            "bindDn": _field("bindDn", value_storage=ldap.get("bindDn"), enc_storage=None, env_name="AUTH_LDAP_BIND_DN", sensitive=OPEN),
            "bindPassword": _field("bindPassword", value_storage=None, enc_storage=ldap.get("bindPasswordEnc"), env_name="AUTH_LDAP_BIND_PASSWORD", sensitive=SENS),
            "userSearchBase": _field(
                "userSearchBase", value_storage=ldap.get("userSearchBase"), enc_storage=None, env_name="AUTH_LDAP_USER_SEARCH_BASE", sensitive=OPEN
            ),
            "userSearchFilter": _field(
                "userSearchFilter",
                value_storage=ldap.get("userSearchFilter"),
                enc_storage=None,
                env_name="AUTH_LDAP_USER_SEARCH_FILTER",
                sensitive=OPEN,
            ),
        },
        "azure": {
            "tenantId": _field("tenantId", value_storage=az.get("tenantId"), enc_storage=None, env_name="AUTH_AZURE_TENANT_ID", sensitive=OPEN),
            "clientId": _field("clientId", value_storage=az.get("clientId"), enc_storage=None, env_name="AUTH_AZURE_CLIENT_ID", sensitive=OPEN),
            "clientSecret": _field("clientSecret", value_storage=None, enc_storage=az.get("clientSecretEnc"), env_name="AUTH_AZURE_CLIENT_SECRET", sensitive=SENS),
        },
        "oidc": {
            "issuer": _field("issuer", value_storage=oi.get("issuer"), enc_storage=None, env_name="AUTH_OIDC_ISSUER", sensitive=OPEN),
            "clientId": _field("clientId", value_storage=oi.get("clientId"), enc_storage=None, env_name="AUTH_OIDC_CLIENT_ID", sensitive=OPEN),
            "clientSecret": _field("clientSecret", value_storage=None, enc_storage=oi.get("clientSecretEnc"), env_name="AUTH_OIDC_CLIENT_SECRET", sensitive=SENS),
            "redirectUri": _field(
                "redirectUri", value_storage=oi.get("redirectUri"), enc_storage=None, env_name="AUTH_OIDC_REDIRECT_URI", sensitive=OPEN
            ),
        },
        "anyEnvironmentLock": any_env_lock,
    }


def _raise_env() -> None:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=ENV_LOCK_MSG)


def apply_admin_patch(org: Organization, body: dict[str, Any]) -> None:
    st: dict[str, Any] = {**_get_storage(org)}

    if _env_set("AUTH_LOCAL_ENABLED") and "localEnabled" in body:
        _raise_env()
    if _env_set("AUTH_EXTERNAL_PROVIDER") and "externalProvider" in body:
        _raise_env()

    if "localEnabled" in body and not _env_set("AUTH_LOCAL_ENABLED"):
        st["localEnabled"] = bool(body["localEnabled"])

    if "externalProvider" in body and not _env_set("AUTH_EXTERNAL_PROVIDER"):
        st["externalProvider"] = _ext_normalize(str(body["externalProvider"]))

    ldap_m = [
        ("url", "AUTH_LDAP_URL", False, None),
        ("bindDn", "AUTH_LDAP_BIND_DN", False, None),
        ("bindPassword", "AUTH_LDAP_BIND_PASSWORD", True, "bindPasswordEnc"),
        ("userSearchBase", "AUTH_LDAP_USER_SEARCH_BASE", False, None),
        ("userSearchFilter", "AUTH_LDAP_USER_SEARCH_FILTER", False, None),
    ]
    if "ldap" in body and isinstance(body["ldap"], dict):
        sub = body["ldap"]
        cur: dict[str, Any] = dict(st.get("ldap") or {}) if isinstance(st.get("ldap"), dict) else {}
        for f, env, sens, ekey in ldap_m:
            if f not in sub:
                continue
            if _env_set(env):
                _raise_env()
            v = sub[f]
            if v is None or (isinstance(v, str) and v.strip() == "" and sens):
                if sens and ekey:
                    cur.pop(ekey, None)
                elif not sens:
                    cur.pop(f, None)
            elif sens and ekey and isinstance(v, str) and v:
                cur[ekey] = pack_encrypted(v)
            elif not sens and v is not None:
                cur[f] = str(v)
        st["ldap"] = cur

    az_m = [("tenantId", "AUTH_AZURE_TENANT_ID", False, None), ("clientId", "AUTH_AZURE_CLIENT_ID", False, None), ("clientSecret", "AUTH_AZURE_CLIENT_SECRET", True, "clientSecretEnc")]
    if "azure" in body and isinstance(body["azure"], dict):
        sub = body["azure"]
        cur: dict[str, Any] = dict(st.get("azure") or {}) if isinstance(st.get("azure"), dict) else {}
        for f, env, sens, ekey in az_m:
            if f not in sub:
                continue
            if _env_set(env):
                _raise_env()
            v = sub[f]
            if v is None or (isinstance(v, str) and v.strip() == "" and sens):
                if sens and ekey:
                    cur.pop(ekey, None)
                elif not sens:
                    cur.pop(f, None)
            elif sens and ekey and isinstance(v, str) and v:
                cur[ekey] = pack_encrypted(v)
            elif not sens and v is not None:
                cur[f] = str(v)
        st["azure"] = cur

    oi_m = [
        ("issuer", "AUTH_OIDC_ISSUER", False, None),
        ("clientId", "AUTH_OIDC_CLIENT_ID", False, None),
        ("clientSecret", "AUTH_OIDC_CLIENT_SECRET", True, "clientSecretEnc"),
        ("redirectUri", "AUTH_OIDC_REDIRECT_URI", False, None),
    ]
    if "oidc" in body and isinstance(body["oidc"], dict):
        sub = body["oidc"]
        cur: dict[str, Any] = dict(st.get("oidc") or {}) if isinstance(st.get("oidc"), dict) else {}
        for f, env, sens, ekey in oi_m:
            if f not in sub:
                continue
            if _env_set(env):
                _raise_env()
            v = sub[f]
            if v is None or (isinstance(v, str) and v.strip() == "" and sens):
                if sens and ekey:
                    cur.pop(ekey, None)
                elif not sens:
                    cur.pop(f, None)
            elif sens and ekey and isinstance(v, str) and v:
                cur[ekey] = pack_encrypted(v)
            elif not sens and v is not None:
                cur[f] = str(v)
        st["oidc"] = cur

    eff_l = _effective_local_enabled(st)
    eff_p = _effective_external_provider(st)
    if not eff_l and eff_p == "none":
        raise HTTPException(
            status_code=400,
            detail="At least one of local (email/password) or an external provider must be enabled for sign-in.",
        )

    org.identityConfig = st
    org.updatedAt = utc_now()


def _nested(d: Any, *path: str) -> Any:
    cur: Any = d
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def _merged_str(root: dict[str, Any], env: str, *key_path: str) -> str | None:
    if _env_set(env):
        return _env_raw(env)
    v = _nested(root, *key_path) if key_path else None
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _ldap_has_bind_secret(st: dict[str, Any]) -> bool:
    if _env_set("AUTH_LDAP_BIND_PASSWORD"):
        return bool(_env_raw("AUTH_LDAP_BIND_PASSWORD"))
    b = st.get("ldap")
    if isinstance(b, dict) and b.get("bindPasswordEnc"):
        return bool(str(b["bindPasswordEnc"]).strip())
    return False


def _azure_has_client_secret(st: dict[str, Any]) -> bool:
    if _env_set("AUTH_AZURE_CLIENT_SECRET"):
        return bool(_env_raw("AUTH_AZURE_CLIENT_SECRET"))
    a = st.get("azure")
    if isinstance(a, dict) and a.get("clientSecretEnc"):
        return bool(str(a["clientSecretEnc"]).strip())
    return False


def _oidc_has_client_secret(st: dict[str, Any]) -> bool:
    if _env_set("AUTH_OIDC_CLIENT_SECRET"):
        return bool(_env_raw("AUTH_OIDC_CLIENT_SECRET"))
    o = st.get("oidc")
    if isinstance(o, dict) and o.get("clientSecretEnc"):
        return bool(str(o["clientSecretEnc"]).strip())
    return False


def local_login_allowed(st: dict[str, Any]) -> bool:
    return _effective_local_enabled(st)


def can_use_local_sign_in(org: Organization) -> bool:
    return local_login_allowed(_get_storage(org))


def is_ldap_config_sufficient_for_ui(st: dict[str, Any]) -> bool:
    u = _merged_str(st, "AUTH_LDAP_URL", "ldap", "url")
    b = _merged_str(st, "AUTH_LDAP_BIND_DN", "ldap", "bindDn")
    base = _merged_str(st, "AUTH_LDAP_USER_SEARCH_BASE", "ldap", "userSearchBase")
    if not (u and b and base and _ldap_has_bind_secret(st)):
        return False
    return _effective_external_provider(st) == "ldap"


def is_azure_config_sufficient_for_ui(st: dict[str, Any]) -> bool:
    t = _merged_str(st, "AUTH_AZURE_TENANT_ID", "azure", "tenantId")
    c = _merged_str(st, "AUTH_AZURE_CLIENT_ID", "azure", "clientId")
    if not (t and c and _azure_has_client_secret(st)):
        return False
    return _effective_external_provider(st) == "azure_ad"


def is_oidc_config_sufficient_for_ui(st: dict[str, Any]) -> bool:
    iss = _merged_str(st, "AUTH_OIDC_ISSUER", "oidc", "issuer")
    c = _merged_str(st, "AUTH_OIDC_CLIENT_ID", "oidc", "clientId")
    if not (iss and c and _oidc_has_client_secret(st)):
        return False
    if _effective_external_provider(st) != "oidc":
        return False
    return bool(_merged_str(st, "AUTH_OIDC_REDIRECT_URI", "oidc", "redirectUri"))


def build_public_auth_provider_catalog(org: Organization | None) -> dict[str, list[dict[str, Any]]]:
    """Unauthenticated; used at login. Env + first org's identityConfig (if any)."""
    st: dict[str, Any] = _get_storage(org) if org is not None else {}
    out: list[dict[str, Any]] = []

    le = _effective_local_enabled(st)
    ext = _effective_external_provider(st)
    l_ready = is_ldap_config_sufficient_for_ui(st)
    z_ready = is_azure_config_sufficient_for_ui(st)
    o_ready = is_oidc_config_sufficient_for_ui(st)

    out.append(
        {
            "id": "local",
            "label": "Email & password",
            "kind": "password",
            "enabled": le,
            "note": "Disabled by configuration" if not le else None,
        }
    )
    l_note: str | None
    if ext not in ("none", "ldap"):
        l_note = "Another external provider is selected. Only one of LDAP, Entra, or OIDC can be active."
    elif not l_ready and ext == "ldap":
        l_note = "LDAP is selected but not fully configured (URL, bind DN, password, and user search base)."
    else:
        l_note = "Set in Admin → Identity, or set AUTH_* env vars." if not l_ready and ext != "ldap" else None

    out.append(
        {
            "id": "ldap",
            "label": "LDAP / Active Directory",
            "kind": "ldap",
            "enabled": l_ready,
            "note": l_note,
        }
    )
    a_note: str | None
    if ext not in ("none", "azure_ad"):
        a_note = "Another external provider is selected."
    elif not z_ready and ext == "azure_ad":
        a_note = "Entra is selected but tenant, client, or client secret is missing."
    else:
        a_note = None if (z_ready or ext == "none") else "Set tenant, app ID, and secret in Admin or via AUTH_AZURE_* ."

    out.append(
        {
            "id": "azure_ad",
            "label": "Microsoft Entra ID (Azure AD)",
            "kind": "azure_ad",
            "enabled": z_ready,
            "note": a_note,
        }
    )
    o_msg: str | None
    if ext not in ("none", "oidc"):
        o_msg = "Another external provider is selected."
    elif not o_ready and ext == "oidc":
        o_msg = "OpenID Connect is selected but issuer, client, client secret, or redirect URI is missing."
    else:
        o_msg = None if (o_ready or ext == "none") else "Configure in Admin or AUTH_OIDC_* ."

    out.append(
        {
            "id": "oidc",
            "label": "OpenID Connect",
            "kind": "oidc",
            "enabled": o_ready,
            "note": o_msg,
        }
    )
    return {"providers": out}
