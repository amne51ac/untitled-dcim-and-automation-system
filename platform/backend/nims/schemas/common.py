"""Reusable Pydantic field types for API request bodies (shared with OpenAPI / JSON Schema export)."""

from typing import Annotated
from uuid import UUID

from pydantic import Field, PlainSerializer

UuidStr = Annotated[
    UUID,
    PlainSerializer(
        lambda v: str(v) if isinstance(v, UUID) else v,
        return_type=str,
        when_used="json",
    ),
]
"""Primary-key UUID; serializes to string in JSON to match the OpenAPI `format: uuid` string wire format."""

NonEmptyName = Annotated[str, Field(min_length=1, description="Display name (non-empty).")]

SlugStr = Annotated[str, Field(min_length=1, description="URL-style slug (non-empty).")]

__all__ = ["NonEmptyName", "SlugStr", "UuidStr"]
