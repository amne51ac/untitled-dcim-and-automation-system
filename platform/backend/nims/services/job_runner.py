"""Job handlers: noop, connector.sync. Outbound HTTP is constrained by ``connector_url_policy``."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from nims.models_generated import ConnectorRegistration, JobDefinition, JobRun
from nims.services.connector_probe import packed_credentials_to_dict, probe_by_connector_type
from nims.timeutil import utc_now


def execute_job(
    db: Session,
    organization_id: uuid.UUID,
    job_key: str,
    run: JobRun,
    defn: JobDefinition,
) -> tuple[dict[str, Any], str]:
    """Run job logic; returns (output_dict, log_line). On failure, output should include `ok: false`."""
    if job_key == "noop":
        return (
            {"ok": True, "message": "No-op completed", "jobKey": defn.key},
            "Handler: noop (success).",
        )
    if job_key == "connector.sync":
        return _run_connector_sync(db, organization_id, run)
    return (
        {"ok": False, "error": f"no handler registered for job key: {job_key}"},
        f"Unknown job key: {job_key}",
    )


def _run_connector_sync(
    db: Session,
    organization_id: uuid.UUID,
    run: JobRun,
) -> tuple[dict[str, Any], str]:
    inp: dict[str, Any] = run.input if isinstance(run.input, dict) else {}
    cid = inp.get("connectorId")
    if not cid:
        return ({"ok": False, "error": "input.connectorId is required"}, "Missing connectorId in run input")
    try:
        c_uuid = uuid.UUID(str(cid))
    except ValueError:
        return ({"ok": False, "error": "invalid connectorId"}, "Invalid UUID in connectorId")

    row = (
        db.execute(
            select(ConnectorRegistration).where(
                ConnectorRegistration.id == c_uuid,
                ConnectorRegistration.organizationId == organization_id,
            ),
        )
    ).scalar_one_or_none()
    if row is None:
        return ({"ok": False, "error": "connector not found"}, "Connector not found")
    if not row.enabled:
        return ({"ok": False, "error": "connector disabled"}, "Connector disabled")

    settings_dict = row.settings if isinstance(row.settings, dict) else {}
    creds = packed_credentials_to_dict(row.credentialsEnc)
    out, log = probe_by_connector_type(row.type, settings_dict, creds)

    now = utc_now()
    row.lastSyncAt = now
    row.lastError = None if (out and out.get("ok")) else str(out.get("error", log))[:2000] if out else log[:2000]
    row.healthStatus = "ok" if (out and out.get("ok")) else "error"
    row.updatedAt = now
    db.add(row)
    return out, log
