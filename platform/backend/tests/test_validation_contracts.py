"""Contract tests: Pydantic validation, OpenAPI shape, and 422 on invalid DCIM bodies."""

import uuid

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from nims.main import app
from nims.schemas.dcim import CableCreate, LocationCreate


def test_post_locations_empty_json_422() -> None:
    client = TestClient(app)
    res = client.post("/v1/locations", json={})
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data
    assert isinstance(data["detail"], list)
    assert any("msg" in str(x) or (isinstance(x, dict) and "msg" in x) for x in data["detail"])


def test_location_create_rejects_lat_without_lon() -> None:
    """Pydantic rejects coordinate pairs when only one of lat/lon is set on create."""
    with pytest.raises(ValidationError) as err:
        LocationCreate(
            name="n",
            slug="s",
            locationTypeId=uuid.uuid4(),
            latitude=1.0,
            longitude=None,
        )
    assert "latitude" in str(err.value).lower() or "longitude" in str(err.value).lower() or "both" in str(err.value).lower()


def test_cable_create_disallows_same_interface() -> None:
    u = uuid.uuid4()
    with pytest.raises(ValidationError):
        CableCreate(interfaceAId=u, interfaceBId=u)


def test_openapi_contains_location_create_and_validation_paths() -> None:
    client = TestClient(app)
    r = client.get("/docs/json")
    assert r.status_code == 200
    spec = r.json()
    assert "components" in spec and "schemas" in spec["components"]
    assert "LocationCreate" in spec["components"]["schemas"]
    paths = spec.get("paths", {})
    assert "/v1/validation/location-type" in paths
