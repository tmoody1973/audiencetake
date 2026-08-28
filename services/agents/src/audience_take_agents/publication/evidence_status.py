"""Conservative, deterministic Scout Card evidence presentation metadata."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal

EvidenceStatus = Literal[
    "verified_core",
    "verification_in_progress",
    "source_limited",
    "conflicting",
]


def derive_evidence_status(
    evidence_ledger: Mapping[str, Any], sources: Sequence[Mapping[str, Any]]
) -> EvidenceStatus:
    """Summarize evidence strength without turning observations into verification."""
    claims = list(evidence_ledger.get("claims", []))
    if any(claim.get("status") == "conflicting" for claim in claims) or any(
        source.get("verificationStatus") == "conflicting" for source in sources
    ):
        return "conflicting"

    sources_by_id = {str(source.get("id")): source for source in sources}
    verified_core = bool(claims) and all(
        claim.get("status") == "supported"
        and any(
            sources_by_id.get(str(source_id), {}).get("availability") == "available"
            and sources_by_id.get(str(source_id), {}).get("verificationStatus") == "verified"
            for source_id in claim.get("sourceIds", [])
        )
        for claim in claims
    )
    if verified_core:
        return "verified_core"
    if evidence_ledger.get("evidenceQuality") == "limited":
        return "source_limited"
    return "verification_in_progress"


def source_presentation(source: Mapping[str, Any]) -> dict[str, str]:
    """Project source role and tier from facts already present in the source contract."""
    origin = str(source.get("origin", ""))
    source_type = str(source.get("sourceType", ""))

    if source.get("externalCommentary") is True:
        role = "commentary"
    elif source_type in {"official_project", "submitted_video"}:
        role = "primary_work"
    elif source_type == "editorial_coverage":
        role = "trade_reporting"
    elif origin == "creator":
        role = "creator_statement"
    elif origin == "community_lead":
        role = "community"
    else:
        role = "other"

    if source_type == "official_project":
        tier = "primary"
    elif origin == "creator":
        tier = "creator_authorized"
    elif source_type == "submitted_video":
        tier = "platform_metadata"
    elif origin == "community_lead":
        tier = "community"
    else:
        tier = "secondary"
    return {"sourceRole": role, "sourceTier": tier}
