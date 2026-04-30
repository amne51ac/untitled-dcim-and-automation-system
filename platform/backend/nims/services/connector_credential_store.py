"""Pack / unpack connector credentials for `ConnectorRegistration.credentialsEnc`.

- **Without** `CONNECTOR_SECRETS_FERNET_KEY`: JSON in the database (dev / legacy; not encryption).
- **With** a Fernet key: values are stored as ``c1:<fernet token>`` (rotation: try previous key on decrypt).
"""

from __future__ import annotations

import json
from typing import Any

from nims.config import get_settings

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover
    Fernet = None  # type: ignore[assignment, misc]
    InvalidToken = Exception  # type: ignore[assignment, misc]

_PREFIX = "c1:"


def _fernet_instances() -> list[Fernet]:
    if Fernet is None:  # pragma: no cover
        raise RuntimeError("cryptography is required for encrypted connector credentials")
    s = get_settings()
    out: list[Fernet] = []
    for raw in (s.connector_secrets_fernet_key, s.connector_secrets_fernet_key_previous):
        if raw and str(raw).strip():
            out.append(Fernet(str(raw).strip().encode("ascii")))
    return out


def pack_credentials(data: dict[str, Any]) -> str:
    """Serialize credentials for DB storage (encrypted when env key is set)."""
    payload = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    fernets = _fernet_instances()
    if not fernets:
        return payload.decode("utf-8")
    token = fernets[0].encrypt(payload).decode("ascii")
    return _PREFIX + token


def unpack_credentials(stored: str | None) -> dict[str, Any] | None:
    """Decode DB value to a dict; returns None for empty or invalid legacy JSON."""
    if not stored or not str(stored).strip():
        return None
    s = str(stored).strip()
    if s.startswith(_PREFIX):
        blob = s.removeprefix(_PREFIX).encode("ascii")
        fernets = _fernet_instances()
        for f in fernets:
            try:
                plain = f.decrypt(blob)
                return json.loads(plain.decode("utf-8"))
            except (InvalidToken, TypeError, ValueError, json.JSONDecodeError):
                continue
        return None
    try:
        d = json.loads(s)
    except (TypeError, json.JSONDecodeError):
        return None
    return d if isinstance(d, dict) else None
