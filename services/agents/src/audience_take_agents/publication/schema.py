"""Canonical JSON Schema validation for publication artifacts."""

from __future__ import annotations

import json
import os
from functools import cache
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator, FormatChecker  # type: ignore[import-untyped]

from audience_take_agents.publication.errors import SemanticContractError

REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
SCHEMA_ROOT = Path(
    os.environ.get(
        "AUDIENCE_TAKE_SCHEMA_ROOT",
        str(REPOSITORY_ROOT / "contracts" / "schemas"),
    )
)


@cache
def _validator(schema_name: str) -> Draft202012Validator:
    path = SCHEMA_ROOT / schema_name
    schema = cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_schema(schema_name: str, payload: dict[str, Any]) -> None:
    """Validate a mapping and turn verbose jsonschema errors into one stable error."""
    errors = sorted(
        _validator(schema_name).iter_errors(payload), key=lambda error: list(error.path)
    )
    if errors:
        details = "; ".join(
            f"{'/'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
            for error in errors
        )
        raise SemanticContractError(f"{schema_name} validation failed: {details}")
