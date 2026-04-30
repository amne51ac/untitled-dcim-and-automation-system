"""Build OpenAI- and Azure OpenAI-compatible chat/completions request URLs and headers."""

from __future__ import annotations

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Default Azure OpenAI data-plane version (chat completions, tools).
# Override with LLM_AZURE_API_VERSION if your resource requires a different one.
_AZURE_API_VERSION_DEFAULT = "2024-02-15-preview"


def azure_api_version() -> str:
    v = os.environ.get("LLM_AZURE_API_VERSION", "").strip()
    return v if v else _AZURE_API_VERSION_DEFAULT


def is_azure_openai_host(url: str) -> bool:
    """
    True when the endpoint is Azure OpenAI (or the older Cognitive Services host used for
    the same /openai/deployments/... APIs). In that case we use api-key and deployment URLs.
    """
    s = (url or "").strip()
    if not s:
        return False
    h = urlsplit(s).netloc.lower()
    return (
        ".openai.azure.com" in h
        or h.endswith("openai.azure.com")
        or ".cognitiveservices.azure.com" in h
    )


def openai_api_base_for_chat(base_url: str) -> str:
    """
    Return a base that works with `.../chat/completions` for the public OpenAI / proxy style.

    If the user passes only a scheme+host (e.g. https://api.openai.com), insert `/v1`.
    If the host is Azure, do not use this — use :func:`chat_completions_url` with a deployment
    name instead; Azure does not use `/v1` on the resource hostname.
    """
    s = (base_url or "").strip().rstrip("/")
    if not s or is_azure_openai_host(s):
        return s
    parts = urlsplit(s)
    path = (parts.path or "").rstrip("/")
    if path in ("", "/"):
        return urlunsplit(parts._replace(path="/v1")).rstrip("/")
    return s


def _merge_azure_query(full_url: str) -> str:
    p = urlsplit(full_url)
    pairs = parse_qsl(p.query, keep_blank_values=True)
    d = {k: v for k, v in pairs}
    d.setdefault("api-version", azure_api_version())
    query = urlencode(d)
    return urlunsplit((p.scheme, p.netloc, p.path, query, p.fragment))


def _azure_chat_completions_url(s: str, deployment: str) -> str:
    """s is stripped; deployment is the Azure deployment name (UI default model / env model)."""
    p = urlsplit(s)
    raw_path = p.path or ""
    dep = (deployment or "").strip()
    if "chat/completions" in raw_path:
        out = s
    elif "/openai/deployments/" in raw_path:
        p3 = raw_path.rstrip("/")
        if not p3.endswith("chat/completions"):
            p3 = f"{p3}/chat/completions"
        out = urlunsplit(p._replace(path=p3))
    else:
        if not dep:
            return ""
        p3 = f"/openai/deployments/{dep}/chat/completions"
        out = urlunsplit(p._replace(path=p3, query=""))
    return _merge_azure_query(out)


def chat_completions_url(base_url: str, *, deployment: str = "") -> str:
    """
    Full POST URL for chat completions.

    * **OpenAI / most proxies:** ``{base}/v1/chat/completions`` (inserts ``/v1`` when the path
      is empty, unless the host is Azure).
    * **Azure OpenAI:** ``.../openai/deployments/{deployment}/chat/completions?api-version=...``
      (``deployment`` should match the configured default model name in most setups).
    """
    s0 = (base_url or "").strip().rstrip("/")
    if not s0:
        return ""
    if is_azure_openai_host(s0):
        u = _azure_chat_completions_url(s0, deployment)
        return u
    b = openai_api_base_for_chat(s0)
    return f"{b.rstrip('/')}/chat/completions" if b else ""


def llm_request_headers(base_url: str, api_key: str) -> dict[str, str]:
    """OpenAI uses Bearer; Azure OpenAI uses ``api-key`` (same secret from the Azure portal)."""
    h: dict[str, str] = {"Content-Type": "application/json"}
    if is_azure_openai_host(base_url):
        h["api-key"] = api_key
    else:
        h["Authorization"] = f"Bearer {api_key}"
    return h


def use_model_in_request_body(base_url: str) -> bool:
    """Azure embeds the deployment in the path; the JSON body should not duplicate ``model``."""
    return not is_azure_openai_host(base_url)
