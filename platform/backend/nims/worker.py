"""Background job worker entrypoint. Requires ``JOB_EXECUTION_MODE=async`` and the same ``DATABASE_URL`` as the API."""

from __future__ import annotations

import logging

from nims.services.job_worker import run_worker_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
)


def main() -> None:
    run_worker_loop()


if __name__ == "__main__":
    main()
