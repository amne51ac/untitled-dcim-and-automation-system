"""Process PENDING `JobRun` rows when ``JOB_EXECUTION_MODE=async``. Run ``nims-worker`` as a separate process."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.orm import Session, joinedload

from nims.config import get_settings
from nims.json_util import to_input_json
from nims.models_generated import JobDefinition, JobRun, Jobrunstatus
from nims.serialize import columns_dict
from nims.services.audit import record_audit
from nims.services.job_runner import execute_job
from nims.timeutil import utc_now

log = logging.getLogger("nims.job_worker")
WORKER_ACTOR = "system:job-worker"


def _claim_one(db: Session) -> tuple[uuid.UUID, uuid.UUID, str, str | None] | None:
    row = (
        db.execute(
            select(JobRun, JobDefinition)
            .join(
                JobDefinition,
                and_(
                    JobRun.jobDefinitionId == JobDefinition.id,
                    JobDefinition.enabled.is_(True),  # noqa: E712
                ),
            )
            .where(
                and_(
                    JobRun.status == Jobrunstatus.PENDING,
                    JobDefinition.requiresApproval.is_(False),  # noqa: E712
                )
            )
            .order_by(JobRun.createdAt.asc())
            .with_for_update(of=JobRun, skip_locked=True)
        )
    ).first()
    if row is None:
        return None
    run, defn = row
    run.status = Jobrunstatus.RUNNING
    run.updatedAt = utc_now()
    db.add(run)
    return (run.id, run.organizationId, defn.key, run.correlationId)


def _finalize(
    db: Session,
    run: JobRun,
    output: dict[str, Any],
    log_line: str,
) -> None:
    run.output = to_input_json(output)
    run.logs = log_line
    if output.get("ok") is False:
        run.status = Jobrunstatus.FAILED
    else:
        run.status = Jobrunstatus.SUCCEEDED
    run.updatedAt = utc_now()
    record_audit(
        db,
        organization_id=run.organizationId,
        actor=WORKER_ACTOR,
        action="job_run",
        resource_type="JobRun",
        resource_id=str(run.id),
        correlation_id=run.correlationId,
        after=columns_dict(run),
    )


def process_one_batch() -> int:
    """Process up to ``job_worker_batch_size`` pending job runs. Returns the number of runs that completed."""
    from nims.db import SessionLocal

    settings = get_settings()
    batch = max(1, int(settings.job_worker_batch_size))
    done = 0
    for _ in range(batch):
        s = SessionLocal()
        claim: tuple[uuid.UUID, uuid.UUID, str, str | None] | None
        try:
            s.begin()
            claim = _claim_one(s)
            if claim is None:
                s.rollback()
                s.close()
                return done
            s.commit()
        except Exception:  # noqa: BLE001
            s.rollback()
            s.close()
            log.exception("claim job run failed")
            return done
        s.close()

        run_id, org_id, defn_key, _corr = claim
        ex = SessionLocal()
        try:
            r = (
                ex.execute(
                    select(JobRun)
                    .where(and_(JobRun.id == run_id, JobRun.organizationId == org_id, JobRun.status == Jobrunstatus.RUNNING))
                    .options(joinedload(JobRun.JobDefinition_))
                )
                .unique()
                .scalar_one_or_none()
            )
            if r is None:
                log.warning("JobRun %s not RUNNING after claim; skipped", run_id)
                ex.close()
                done += 1
                continue
            d = r.JobDefinition_
            if d is None or d.key != defn_key:
                log.error("JobRun %s definition drift", run_id)
                ex.close()
                done += 1
                continue
            output, log_line = execute_job(ex, org_id, defn_key, r, d)
            if r.status != Jobrunstatus.RUNNING:
                ex.rollback()
            else:
                _finalize(ex, r, output, log_line)
                ex.commit()
                log.info("JobRun %s %s (key=%s)", run_id, r.status, defn_key)
        except Exception:  # noqa: BLE001
            ex.rollback()
            log.exception("execute job run %s failed", run_id)
            ex2: Session | None = None
            try:
                ex2 = SessionLocal()
                r3 = ex2.get(JobRun, run_id)
                if r3 and r3.status == Jobrunstatus.RUNNING:
                    r3.status = Jobrunstatus.FAILED
                    r3.logs = (r3.logs or "") + "\nWorker: execution error; see server logs."
                    r3.output = to_input_json({"ok": False, "error": "worker exception"})
                    r3.updatedAt = utc_now()
                    ex2.add(r3)
                    ex2.commit()
            finally:
                if ex2 is not None:
                    ex2.close()
        finally:
            ex.close()
        done += 1
    return done


def run_worker_loop() -> None:
    """Poll loop for the worker process."""
    settings = get_settings()
    if settings.job_execution_mode.lower() not in ("async", "asynchronous", "queue"):
        log.error("JOB_EXECUTION_MODE must be 'async' for nims-worker")
        return
    interval = max(0.5, float(settings.job_worker_poll_interval_sec))
    log.info("nims job worker (interval=%ss, batch=%s)", interval, settings.job_worker_batch_size)
    while True:
        try:
            count = process_one_batch()
            if count == 0:
                time.sleep(interval)
        except KeyboardInterrupt:
            log.info("job worker exit")
            break
        except Exception:  # noqa: BLE001
            log.exception("job worker tick failed")
            time.sleep(interval)
