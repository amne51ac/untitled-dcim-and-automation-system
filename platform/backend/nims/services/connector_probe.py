"""Outbound HTTP probe for connectors (shared by jobs and /v1/connectors/test)."""

from __future__ import annotations

from typing import Any

import httpx

from nims.config import get_settings
from nims.services.connector_credential_store import unpack_credentials
from nims.services.connector_url_policy import assert_connector_url_allowed


def auth_headers_from_credentials(creds: dict[str, Any] | None) -> dict[str, str]:
    if not creds:
        return {}
    auth = creds.get("authorization")
    if isinstance(auth, str) and auth.strip():
        return {"Authorization": auth.strip()}
    token = creds.get("bearerToken")
    if isinstance(token, str) and token.strip():
        return {"Authorization": f"Bearer {token.strip()}"}
    return {}


def http_request_probe(
    method: str,
    url: str,
    extra_headers: dict[str, str],
) -> tuple[dict[str, Any], str]:
    """Best-effort outbound call; returns (result_dict, log_line)."""
    settings = get_settings()
    try:
        with httpx.Client(
            timeout=20.0,
            follow_redirects=bool(getattr(settings, "connector_http_follow_redirects", False)),
        ) as client:
            req_headers = {k: v for k, v in extra_headers.items()}
            if method == "GET":
                r = client.get(url, headers=req_headers)
            else:
                r = client.post(url, json={}, headers=req_headers)
        body: dict[str, Any] = {
            "ok": 200 <= r.status_code < 300,
            "statusCode": r.status_code,
            "bytes": len(r.content or b""),
        }
        if not body["ok"]:
            body["error"] = f"HTTP {r.status_code}"
        log = f"HTTP {method} {url} -> {r.status_code} ({body['bytes']} bytes)"
        return body, log
    except Exception as e:
        return ({"ok": False, "error": str(e)}), f"Request failed: {e}"


def probe_by_connector_type(
    connector_type: str,
    settings: dict[str, Any],
    credentials: dict[str, Any] | None,
) -> tuple[dict[str, Any], str]:
    """
    Same behavior as the connector.sync job: GET/POST based on type and settings.url
    (with SSRF checks and optional auth from credentials).
    """
    t = (connector_type or "").lower()
    settings_dict = settings if isinstance(settings, dict) else {}
    creds = credentials
    extra_headers = auth_headers_from_credentials(creds)

    st = get_settings()
    if t == "webhook_outbound":
        url = settings_dict.get("url")
        if not url or not isinstance(url, str):
            return ({"ok": False, "error": "settings.url is required for webhook_outbound"}), "Invalid settings: missing url"
        try:
            assert_connector_url_allowed(url, st)
        except ValueError as e:
            return ({"ok": False, "error": f"url policy: {e}"}), str(e)
        return http_request_probe("POST", str(url), extra_headers)
    if t in ("http_get", "generic_rest", "http_poll"):
        url = settings_dict.get("url")
        if not url or not isinstance(url, str):
            return ({"ok": False, "error": "settings.url is required"}), "Invalid settings: missing url"
        try:
            assert_connector_url_allowed(url, st)
        except ValueError as e:
            return ({"ok": False, "error": f"url policy: {e}"}), str(e)
        return http_request_probe("GET", str(url), extra_headers)

    return (
        {
            "ok": True,
            "skipped": True,
            "connectorType": connector_type,
            "reason": "No network probe for this type; use webhook_outbound or http_get to exercise outbounds.",
        }
    ), f"Placeholder handler for type {connector_type!r} (no outbound HTTP)."


def packed_credentials_to_dict(credentials_enc: str | None) -> dict[str, Any] | None:
    if not credentials_enc:
        return None
    d = unpack_credentials(credentials_enc)
    return d if isinstance(d, dict) else None
