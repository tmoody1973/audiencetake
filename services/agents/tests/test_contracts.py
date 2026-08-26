import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
CONTRACTS_ROOT = REPOSITORY_ROOT / "contracts"


def test_all_shared_fixtures_match_their_canonical_schema() -> None:
    manifest = json.loads((CONTRACTS_ROOT / "fixtures" / "manifest.json").read_text())

    for pair in manifest:
        schema = json.loads((CONTRACTS_ROOT / "schemas" / pair["schema"]).read_text())
        fixture = json.loads((CONTRACTS_ROOT / "fixtures" / pair["fixture"]).read_text())
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        errors = sorted(validator.iter_errors(fixture), key=lambda error: list(error.path))

        assert not errors, (
            f"{pair['fixture']} failed {pair['schema']}: "
            + "; ".join(error.message for error in errors)
        )
