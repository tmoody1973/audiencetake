"""Cross-artifact truth and evidence relationship checks."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from audience_take_agents.publication.errors import SemanticContractError

_NAMED_PLATFORM = re.compile(
    r"\b(?:netflix|hbo(?:/max)?|max|adult swim|crunchyroll|disney\+?|hulu|apple tv\+?|amazon)\b",
    re.IGNORECASE,
)
_INTEREST_ASSERTION = re.compile(
    r"\b(?:interested|expressed interest|wants|seeks|endorsed|greenlit|will acquire|acquisition)\b",
    re.IGNORECASE,
)
_INTEREST_DENIAL = re.compile(
    r"(?:\bno\b.{0,40}\b(?:interest|endorsement|acquisition)\b|"
    r"\b(?:has|have|had|is|are|was|were|does|do|did)\s+not\b.{0,40}"
    r"\b(?:interest|interested|endorsed|acquire|acquisition)\b)",
    re.IGNORECASE,
)


def values(items: Iterable[Mapping[str, Any]], key: str) -> set[str]:
    return {str(item[key]) for item in items}


def require_references(
    references: Iterable[str], available: set[str], *, relationship: str
) -> None:
    missing = sorted(set(references) - available)
    if missing:
        raise SemanticContractError(f"{relationship} references missing IDs: {', '.join(missing)}")


def enforce_named_platform_proof(
    statement: str,
    source_ids: Sequence[str],
    sources_by_id: Mapping[str, Mapping[str, Any]],
) -> None:
    """Require direct verified evidence for a positive named-platform interest assertion."""
    if not (
        _NAMED_PLATFORM.search(statement) and _INTEREST_ASSERTION.search(statement)
    ) or _INTEREST_DENIAL.search(statement):
        return
    direct_proof = any(
        sources_by_id[source_id].get("verificationStatus") == "verified"
        and sources_by_id[source_id].get("availability") == "available"
        for source_id in source_ids
        if source_id in sources_by_id
    )
    if not direct_proof:
        raise SemanticContractError(
            "named platforms cannot be described as interested without available, verified proof"
        )


def text_fragments(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, Mapping):
        for nested in value.values():
            yield from text_fragments(nested)
    elif isinstance(value, Sequence):
        for nested in value:
            yield from text_fragments(nested)
