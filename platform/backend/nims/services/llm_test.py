"""Minimal OpenAI-compatible /chat/completions call for admin connection tests."""

from __future__ import annotations

import httpx
from typing import Any

from nims.services.llm_url import (
    chat_completions_url,
    llm_request_headers,
    use_model_in_request_body,
)


def test_openai_chat_minimal(base_url: str, api_key: str, model: str) -> tuple[bool, str]:
    """
    One short completion to verify the endpoint accepts auth and model.
    Returns (ok, message for UI).
    """
    url = chat_completions_url(base_url, deployment=model)
    if not url:
        return (
            False,
            "For Azure OpenAI, set a default model / deployment name that matches a deployment in Azure.",
        )
    j: dict[str, Any] = {
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }
    if use_model_in_request_body(base_url):
        j["model"] = model
    try:
        with httpx.Client(timeout=httpx.Timeout(45.0, connect=15.0)) as client:
            r = client.post(
                url,
                headers=llm_request_headers(base_url, api_key),
                json=j,
            )
    except Exception as e:
        return False, f"Request failed: {e}"
    if r.status_code >= 400:
        t = (r.text or "")[:500]
        return False, f"HTTP {r.status_code}: {t or 'error'}"
    try:
        data = r.json()
    except Exception:
        return True, f"OK (status {r.status_code}; non-JSON body)."
    choice0 = (data.get("choices") or [{}])[0] if isinstance(data, dict) else {}
    msg = choice0.get("message", {}) if isinstance(choice0, dict) else {}
    content = msg.get("content") if isinstance(msg, dict) else None
    if content is not None:
        return True, f"OK — model responded ({len(str(content))} char preview)."
    return True, f"OK — {r.status_code} (unexpected response shape but server accepted the request)."
