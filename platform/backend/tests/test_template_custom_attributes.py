"""Tests for template-driven customAttributes validation."""

from nims.services.template_custom_attributes import (
    build_custom_attributes_json_schema,
    collect_custom_attribute_validation_errors,
)


def test_collect_required_missing() -> None:
    definition = {
        "fields": [
            {"key": "costCenter", "builtin": False, "type": "string", "required": True},
        ],
    }
    errs = collect_custom_attribute_validation_errors({}, definition)
    assert errs
    assert errs[0]["code"] == "custom_attribute.missing"


def test_collect_strict_rejects_unknown_key() -> None:
    definition = {
        "strictCustomAttributes": True,
        "fields": [
            {"key": "ok", "builtin": False, "type": "string"},
        ],
    }
    errs = collect_custom_attribute_validation_errors({"ok": "x", "nope": 1}, definition)
    assert any(e["code"] == "custom_attributes.unknown_key" for e in errs)


def test_collect_enum_options() -> None:
    definition = {
        "fields": [
            {"key": "tier", "builtin": False, "type": "string", "options": ["a", "b"]},
        ],
    }
    assert not collect_custom_attribute_validation_errors({"tier": "a"}, definition)
    errs = collect_custom_attribute_validation_errors({"tier": "c"}, definition)
    assert any(e["code"] == "custom_attribute.enum" for e in errs)


def test_pattern_on_string() -> None:
    definition = {
        "fields": [
            {"key": "code", "builtin": False, "type": "string", "pattern": r"[A-Z]{3}"},
        ],
    }
    assert not collect_custom_attribute_validation_errors({"code": "ABC"}, definition)
    errs = collect_custom_attribute_validation_errors({"code": "ab"}, definition)
    assert any(e["code"] == "custom_attribute.pattern" for e in errs)


def test_build_json_schema_has_required() -> None:
    definition = {
        "fields": [
            {"key": "x", "builtin": False, "type": "integer", "required": True},
        ],
    }
    schema = build_custom_attributes_json_schema(definition)
    assert schema is not None
    assert schema.get("required") == ["x"]
