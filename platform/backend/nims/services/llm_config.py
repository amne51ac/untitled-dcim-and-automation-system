"""
Effective LLM settings: process env (LLM_*) overrides org `Organization.llmConfig` JSON.
Pattern mirrors identity_settings (env wins; UI read-only for locked fields).
"""

from __future__ import annotations

import os
import re
from copy import deepcopy
from typing import Any

from fastapi import HTTPException, status

from nims.identity_crypto import pack_encrypted, unpack_encrypted
from nims.models_generated import Organization

ENV_LOCK_MSG = "LLM settings configured in the environment cannot be changed in the interface"

# API key stored in org llmConfig under this key (Fernet-prefixed blob).
_KEY_API = "apiKeyEnc"


def _env_raw(name: str) -> str | None:
    v = os.environ.get(name)
    if v is None or not str(v).strip():
        return None
    return str(v).strip()


def _env_set(name: str) -> bool:
    return _env_raw(name) is not None


def resolve_llm_for_connection_test(
    org: Organization,
    body: dict[str, Any] | None,
) -> dict[str, str]:
    """
    Merge form overrides (when not locked by environment) with stored/effective values.
    Returns { baseUrl, defaultModel, apiKey } for a minimal chat test; raises HTTPException 400 if incomplete.
    """
    eff = get_effective_llm_for_runtime(org)
    o: dict[str, Any] = dict(body or {})
    if _env_set("LLM_BASE_URL"):
        base: str | None = eff.get("baseUrl")  # type: ignore[assignment]
    else:
        bu = o.get("baseUrl") or o.get("base_url")
        if isinstance(bu, str) and bu.strip():
            base = str(bu).strip().rstrip("/")
        else:
            b = eff.get("baseUrl")
            base = str(b).rstrip("/") if isinstance(b, str) and b else None
    if _env_set("LLM_DEFAULT_MODEL"):
        model: str = str(eff.get("defaultModel") or "gpt-4.1-mini")
    else:
        dm = o.get("defaultModel") or o.get("default_model")
        if isinstance(dm, str) and dm.strip():
            model = dm.strip()
        else:
            em = eff.get("defaultModel")
            model = str(em).strip() if em is not None else "gpt-4.1-mini"
    if not model:
        model = "gpt-4.1-mini"
    if _env_set("LLM_API_KEY"):
        key: str | None = eff.get("apiKey")  # type: ignore[assignment]
    else:
        ak = o.get("apiKey") or o.get("api_key")
        if isinstance(ak, str) and ak.strip():
            key = ak.strip()
        else:
            k = eff.get("apiKey")
            key = str(k) if k else None
    if not base or not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Base URL and API key are required to test. Enter a key in the form or set LLM_* in the environment.",
        )
    return {
        "baseUrl": str(base).rstrip("/"),
        "defaultModel": str(model or "gpt-4.1-mini"),
        "apiKey": str(key),
    }


def get_effective_llm_for_runtime(org: Organization) -> dict[str, Any]:
    """
    Returns { enabled, baseUrl, defaultModel, apiKey } for server-side OpenAI client.
    `apiKey` is plain text; never return this to the client.
    """
    st: dict[str, Any] = deepcopy(org.llmConfig) if isinstance(org.llmConfig, dict) else {}
    if not st.get("baseUrl") and st.get("base_url"):
        st["baseUrl"] = st.get("base_url")
    if not st.get("defaultModel") and st.get("default_model"):
        st["defaultModel"] = st.get("default_model")

    base_url = _env_raw("LLM_BASE_URL") or (str(st.get("baseUrl")).strip() if st.get("baseUrl") else None)
    if isinstance(base_url, str):
        base_url = base_url.rstrip("/")

    def _b_enabled() -> bool:
        ev = _env_raw("LLM_ENABLED")
        if ev is not None:
            if ev in ("0", "false", "False", "no", "off"):
                return False
            return ev in ("1", "true", "True", "yes", "on")
        v = st.get("enabled")
        if isinstance(v, bool):
            return v
        if v is not None and str(v) in ("1", "0"):
            return str(v) == "1"
        return bool(base_url)

    api_key = _env_raw("LLM_API_KEY")
    if api_key is None and isinstance(st.get(_KEY_API), str):
        api_key = unpack_encrypted(str(st[_KEY_API])) or _legacy_plain_key(st)
    default_model = _env_raw("LLM_DEFAULT_MODEL") or st.get("defaultModel") or "gpt-4.1-mini"

    return {
        "enabled": _b_enabled(),
        "baseUrl": base_url,
        "defaultModel": str(default_model).strip() if default_model else "gpt-4.1-mini",
        "apiKey": api_key,
    }


def _legacy_plain_key(st: dict[str, Any]) -> str | None:
    for k in ("apiKey", "api_key", "openaiApiKey"):
        v = st.get(k)
        if isinstance(v, str) and v.strip() and not v.startswith("nims$"):
            return v
    return None


def _mask(s: str | None) -> str:
    if not s or len(s) < 4:
        return "••••••••"
    return f"****{s[-4:]}"


def build_admin_llm_response(org: Organization) -> dict[str, Any]:
    """For GET /v1/admin/llm: effective values, lock flags, no plaintext secrets."""
    st: dict[str, Any] = deepcopy(org.llmConfig) if isinstance(org.llmConfig, dict) else {}
    if not st.get("baseUrl") and st.get("base_url"):
        st["baseUrl"] = st.get("base_url")
    if not st.get("defaultModel") and st.get("default_model"):
        st["defaultModel"] = st.get("default_model")

    env_enabled = _env_set("LLM_ENABLED")
    env_url = _env_set("LLM_BASE_URL")
    env_key = _env_set("LLM_API_KEY")
    env_model = _env_set("LLM_DEFAULT_MODEL")

    r_env = get_effective_llm_for_runtime(org)
    raw_key = r_env.get("apiKey")
    has_key = bool(raw_key) or (isinstance(st.get(_KEY_API), str) and bool(st.get(_KEY_API)))

    def mask_from_plain(p: str | None) -> str | None:
        if not p:
            return None
        return f"****{p[-4:]}" if len(p) >= 4 else "••••••••"

    def src_enabled() -> str:
        if env_enabled:
            return "env"
        if st.get("enabled") is not None:
            return "database"
        return "default"

    if env_key:
        masked = mask_from_plain(_env_raw("LLM_API_KEY"))
    elif raw_key:
        masked = mask_from_plain(str(raw_key))
    elif isinstance(st.get(_KEY_API), str) and st[_KEY_API]:
        u = unpack_encrypted(st[_KEY_API])
        masked = mask_from_plain(u)
    else:
        masked = None

    return {
        "enabled": r_env.get("enabled", False),
        "baseUrl": r_env.get("baseUrl"),
        "defaultModel": r_env.get("defaultModel"),
        "apiKeySet": has_key,
        "apiKeyMasked": masked,
        "fieldSources": {
            "enabled": src_enabled(),
            "baseUrl": "env" if env_url else ("database" if st.get("baseUrl") else "default"),
            "defaultModel": "env" if env_model else ("database" if st.get("defaultModel") else "default"),
            "apiKey": "env"
            if env_key
            else ("database" if (isinstance(st.get(_KEY_API), str) and st[_KEY_API]) else "none"),  # noqa: E501
        },
        "fieldLocked": {
            "enabled": env_enabled,
            "baseUrl": env_url,
            "defaultModel": env_model,
            "apiKey": env_key,
        },
        "message": ENV_LOCK_MSG if (env_url or env_key or env_model or env_enabled) else None,
    }


def _raise_env() -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=ENV_LOCK_MSG,
    )


def _norm_model(v: str | int | bool | None) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if s.lower() in ("false", "0", "no", "off"):
        return "false"  # signal disable for enabled field
    return s


def apply_admin_llm_patch(org: Organization, body: dict[str, Any]) -> None:
    """Mutates org.llmConfig. Caller commits and may flag_modified."""
    st: dict[str, Any] = deepcopy(org.llmConfig) if isinstance(org.llmConfig, dict) else {}
    for alt, primary in (("base_url", "baseUrl"), ("default_model", "defaultModel"), ("api_key", "apiKey")):
        if primary not in st and alt in st:
            st[primary] = st.get(alt)

    if _env_set("LLM_ENABLED") and "enabled" in body:
        _raise_env()
    if _env_set("LLM_BASE_URL") and (body.get("baseUrl") is not None or body.get("base_url") is not None):
        _raise_env()
    if _env_set("LLM_DEFAULT_MODEL") and (body.get("defaultModel") is not None or body.get("default_model") is not None):
        _raise_env()
    if _env_set("LLM_API_KEY") and (body.get("apiKey") is not None or body.get("api_key") is not None):
        _raise_env()

    if "enabled" in body and not _env_set("LLM_ENABLED"):
        st["enabled"] = bool(body["enabled"])

    if (body.get("baseUrl") is not None or body.get("base_url") is not None) and not _env_set("LLM_BASE_URL"):
        bu = body.get("baseUrl") or body.get("base_url")
        b = _norm_model(bu) if not isinstance(bu, bool) else str(bu)
        if b and b not in ("false", "None"):
            st["baseUrl"] = str(bu).rstrip("/") if isinstance(bu, str) else b
        else:
            st.pop("baseUrl", None)
            st.pop("base_url", None)

    if (body.get("defaultModel") is not None or body.get("default_model") is not None) and not _env_set("LLM_DEFAULT_MODEL"):
        dm = body.get("defaultModel") if body.get("defaultModel") is not None else body.get("default_model")
        if dm and str(dm).strip():
            st["defaultModel"] = str(dm).strip()
        else:
            st.pop("defaultModel", None)

    if not _env_set("LLM_API_KEY"):
        ak = body.get("apiKey") or body.get("api_key")
        if ak is not None:
            a = str(ak).strip()
            if a == "":
                st.pop(_KEY_API, None)
            else:
                st[_KEY_API] = pack_encrypted(a)

    for k in ("openaiApiKey", "openai_api_key", "default_model", "base_url"):
        st.pop(k, None)

    org.llmConfig = st


# --- Context templates for variable substitution in Copilot skills ---

_PLACE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def apply_skill_template(body: str, context: dict[str, Any] | None) -> str:
    if not body:
        return ""
    ctx = context or {}

    def sub(m: re.Match[str]) -> str:
        key = m.group(1)
        v = ctx.get(key) or ctx.get(key.lower()) or ctx.get(camelize(key))
        if v is not None and str(v).strip():
            return str(v)
        return f"({key}: unknown)"

    return _PLACE.sub(sub, body)


def camelize(s: str) -> str:  # minimal: resourceType from resource_type
    parts = s.split("_")
    if not parts:
        return s
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])
