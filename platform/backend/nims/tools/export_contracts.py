"""
Export the FastAPI OpenAPI document and Pydantic JSON Schemas for DCIM request bodies.

Run from the repo: ``uv run --directory platform/backend python -m nims.tools.export_contracts``

Used by CI to detect drift. The web app consumes ``openapi.json`` and per-model
schemas for client-side validation (Ajv). The same OpenAPI JSON is written under
``docs/assets/openapi.json`` for the GitHub Pages Swagger explorer on ``api.html``.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Ensure the backend package root is on the path when executed as a script
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

os.environ.setdefault("NIMS_MCP_ENABLE", "false")


def _platform_web_api_dir() -> Path:
    # nims/tools -> nims -> backend -> platform
    return Path(__file__).resolve().parents[3] / "web" / "src" / "api"


def _docs_assets_dir() -> Path:
    # platform -> repo root -> docs/assets (GitHub Pages static site)
    return Path(__file__).resolve().parents[4] / "docs" / "assets"


def _platform_web_schemas_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "web" / "src" / "validation" / "pydantic-schemas"


def main() -> None:
    from nims.main import app
    from nims.schemas.dcim import (  # noqa: WPS433
        CableCreate,
        DeviceCreate,
        DeviceUpdate,
        InterfaceCreate,
        LocationCreate,
        LocationUpdate,
        RackCreate,
        RackUpdate,
    )

    api_dir = _platform_web_api_dir()
    api_dir.mkdir(parents=True, exist_ok=True)
    spec_text = json.dumps(app.openapi(), indent=2, ensure_ascii=True) + "\n"
    openapi_path = api_dir / "openapi.json"
    openapi_path.write_text(spec_text, encoding="utf-8")

    docs_assets = _docs_assets_dir()
    docs_assets.mkdir(parents=True, exist_ok=True)
    (docs_assets / "openapi.json").write_text(spec_text, encoding="utf-8")

    schemas: dict[str, type] = {
        "LocationCreate": LocationCreate,
        "LocationUpdate": LocationUpdate,
        "RackCreate": RackCreate,
        "RackUpdate": RackUpdate,
        "DeviceCreate": DeviceCreate,
        "DeviceUpdate": DeviceUpdate,
        "InterfaceCreate": InterfaceCreate,
        "CableCreate": CableCreate,
    }
    out_dir = _platform_web_schemas_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    bundle: dict[str, object] = {}
    for name, model in schemas.items():
        bundle[name] = model.model_json_schema()
        (out_dir / f"{name}.json").write_text(
            json.dumps(bundle[name], indent=2, ensure_ascii=True) + "\n",
            encoding="utf-8",
        )
    (out_dir / "index.json").write_text(
        json.dumps({"title": "pydantic-json-schemas", "version": 1, "models": list(bundle.keys())}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {openapi_path}")
    print(f"Wrote {docs_assets / 'openapi.json'}")
    print(f"Wrote {len(schemas)} schemas under {out_dir}")


if __name__ == "__main__":
    main()
