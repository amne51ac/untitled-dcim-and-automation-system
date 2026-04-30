"""Connectivity checks for identity directory settings (admin test only)."""

from __future__ import annotations

from typing import Any, Literal

import httpx
from fastapi import HTTPException, status
from ldap3 import Connection, Server
from ldap3.core.exceptions import LDAPException

from nims.identity_crypto import unpack_encrypted
from nims.models_generated import Organization
from nims.services.identity_settings import _env_raw, _env_set, _get_storage, _merged_str


def _bind_password_ldap(st: dict[str, Any], overrides: dict[str, str] | None) -> str | None:
    o = overrides or {}
    b = o.get("bindPassword")
    if isinstance(b, str) and b.strip():
        return b.strip()
    if _env_set("AUTH_LDAP_BIND_PASSWORD"):
        return _env_raw("AUTH_LDAP_BIND_PASSWORD")
    ldap = st.get("ldap") if isinstance(st.get("ldap"), dict) else {}
    enc = ldap.get("bindPasswordEnc")
    if enc:
        return unpack_encrypted(str(enc)) or None
    return None


def _resolve_ldap_params(
    org: Organization,
    overrides: dict[str, str] | None,
) -> tuple[str, str, str]:
    st = _get_storage(org)
    o = {k: str(v) for k, v in (overrides or {}).items() if v is not None}
    # Prefer non-empty form values when not locked by env
    if not _env_set("AUTH_LDAP_URL") and o.get("url", "").strip():
        url = o["url"].strip()
    else:
        u = _merged_str(st, "AUTH_LDAP_URL", "ldap", "url")
        url = u or ""
    if not _env_set("AUTH_LDAP_BIND_DN") and o.get("bindDn", "").strip():
        bind_dn = o["bindDn"].strip()
    else:
        b = _merged_str(st, "AUTH_LDAP_BIND_DN", "ldap", "bindDn")
        bind_dn = b or ""
    pw = _bind_password_ldap(st, o)
    if not url or not bind_dn or not pw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LDAP test needs server URL, bind DN, and password (or a saved password / AUTH_LDAP_BIND_PASSWORD).",
        )
    return url, bind_dn, pw


def test_ldap_bind(org: Organization, overrides: dict[str, str] | None) -> tuple[bool, str]:
    url, bind_dn, pw = _resolve_ldap_params(org, overrides)
    try:
        server = Server(url, connect_timeout=15, receive_timeout=20)
        conn = Connection(
            server,
            user=bind_dn,
            password=pw,
            auto_bind=True,
            receive_timeout=20,
        )
    except (LDAPException, OSError) as e:
        return False, f"LDAP bind failed: {e}"
    try:
        conn.unbind()
    except Exception:  # noqa: S110
        pass
    return True, "LDAP bind succeeded."


def _azure_tenant_openid(tenant: str) -> tuple[bool, str]:
    t = tenant.strip()
    u = f"https://login.microsoftonline.com/{t}/v2.0/.well-known/openid-configuration"
    with httpx.Client(timeout=httpx.Timeout(20.0, connect=10.0), follow_redirects=True) as client:
        r = client.get(u)
    if r.status_code >= 400:
        return False, f"Microsoft OpenID metadata returned HTTP {r.status_code}."
    try:
        data = r.json()
    except Exception:
        return True, "Microsoft metadata returned non-JSON (unexpected but reachable)."
    if not isinstance(data, dict) or not data.get("authorization_endpoint"):
        return False, "Microsoft metadata missing authorization_endpoint (check tenant id)."
    return True, "Reachable Microsoft Entra OpenID configuration for this tenant."


def _resolve_azure_tenant(org: Organization, overrides: dict[str, str] | None) -> str:
    st = _get_storage(org)
    o = {k: str(v) for k, v in (overrides or {}).items() if v is not None}
    if not _env_set("AUTH_AZURE_TENANT_ID") and o.get("tenantId", "").strip():
        t = o["tenantId"].strip()
    else:
        m = _merged_str(st, "AUTH_AZURE_TENANT_ID", "azure", "tenantId")
        t = (m or "").strip()
    if not t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Microsoft Entra test needs a tenant id (or AUTH_AZURE_TENANT_ID in the environment).",
        )
    return t


def test_azure_ad_microsoft_reachability(
    org: Organization,
    overrides: dict[str, str] | None,
) -> tuple[bool, str]:
    t = _resolve_azure_tenant(org, overrides)
    return _azure_tenant_openid(t)


def _resolve_oidc_issuer(org: Organization, overrides: dict[str, str] | None) -> str:
    st = _get_storage(org)
    o = {k: str(v) for k, v in (overrides or {}).items() if v is not None}
    if not _env_set("AUTH_OIDC_ISSUER") and o.get("issuer", "").strip():
        iss = o["issuer"].strip()
    else:
        m = _merged_str(st, "AUTH_OIDC_ISSUER", "oidc", "issuer")
        iss = (m or "").strip()
    if not iss:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenID test needs an issuer URL (or AUTH_OIDC_ISSUER).",
        )
    return iss.rstrip("/")


def test_oidc_issuer_reachable(
    org: Organization,
    overrides: dict[str, str] | None,
) -> tuple[bool, str]:
    iss = _resolve_oidc_issuer(org, overrides)
    meta = f"{iss.rstrip('/')}/.well-known/openid-configuration"
    with httpx.Client(timeout=httpx.Timeout(20.0, connect=10.0), follow_redirects=True) as client:
        r = client.get(meta)
    if r.status_code >= 400:
        return False, f"Issuer metadata returned HTTP {r.status_code}."
    try:
        data = r.json()
    except Exception:
        return True, "Issuer returned non-JSON (unexpected but reachable)."
    if not isinstance(data, dict) or not data.get("authorization_endpoint"):
        return False, "OpenID configuration missing authorization_endpoint; check issuer URL."
    return True, f"Issuer reachable: {iss}"


def run_identity_test(
    org: Organization,
    target: Literal["ldap", "azure_ad", "oidc"],
    overrides: dict[str, str] | None = None,
) -> tuple[bool, str]:
    if target == "ldap":
        return test_ldap_bind(org, overrides)
    if target == "azure_ad":
        return test_azure_ad_microsoft_reachability(org, overrides)
    if target == "oidc":
        return test_oidc_issuer_reachable(org, overrides)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid test target")
