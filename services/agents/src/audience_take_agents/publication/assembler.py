"""Scout Card assembly and cross-contract validation."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from audience_take_agents.publication.errors import SemanticContractError
from audience_take_agents.publication.media import privacy_enhanced_youtube_embed
from audience_take_agents.publication.pathways import PathwayStrategist
from audience_take_agents.publication.schema import validate_schema
from audience_take_agents.publication.truth import (
    enforce_named_platform_proof,
    require_references,
)


class ScoutCardAssembler:
    """Validate that a card is a coherent view of its immutable research artifacts."""

    def validate(
        self,
        card: dict[str, Any],
        *,
        evidence_ledger: Mapping[str, Any],
        pathways: Sequence[dict[str, Any]],
        sources: Sequence[dict[str, Any]],
        allow_fallback: bool = False,
    ) -> dict[str, Any]:
        assembled = deepcopy(card)
        validate_schema("evidence-ledger.schema.json", dict(evidence_ledger))
        normalized_pathways = PathwayStrategist().validate(
            pathways, evidence_ledger=evidence_ledger, sources=sources
        )
        validate_schema("scout-card.schema.json", assembled)

        if (
            assembled["runId"] != evidence_ledger["runId"]
            or assembled["projectId"] != evidence_ledger["projectId"]
        ):
            raise SemanticContractError("Scout Card identity does not match evidence ledger")
        if assembled["researchVersion"] != evidence_ledger["researchVersion"]:
            raise SemanticContractError(
                "Scout Card research version does not match evidence ledger"
            )
        if assembled["fallbackUsed"] and not allow_fallback:
            raise SemanticContractError("a live publication cannot publish a fallback card")

        source_ids = {str(source["id"]) for source in sources}
        card_source_ids = {str(item) for item in assembled["sourceIds"]}
        ledger_source_ids = {str(item["id"]) for item in assembled["sourceLedger"]}
        if card_source_ids != ledger_source_ids:
            raise SemanticContractError("card sourceIds must exactly match sourceLedger IDs")
        require_references(card_source_ids, source_ids, relationship="Scout Card source ledger")

        media = assembled["media"]
        media_source_url = str(media["sourceUrl"])
        ledger_source_urls = {str(item["url"]) for item in assembled["sourceLedger"]}
        if media_source_url not in ledger_source_urls:
            raise SemanticContractError("Scout Card media must reference a source ledger URL")
        if media["state"] == "authorized_embed":
            expected_embed_url = privacy_enhanced_youtube_embed(media_source_url)
            if expected_embed_url is None or media.get("embedUrl") != expected_embed_url:
                raise SemanticContractError(
                    "Scout Card YouTube embed must match its submitted source"
                )

        ledger_claims = {str(item["id"]): item for item in evidence_ledger["claims"]}
        card_claims = {str(item["id"]): item for item in assembled["evidenceClaims"]}
        if set(card_claims) != {str(item) for item in assembled["claimIds"]}:
            raise SemanticContractError("card claimIds must exactly match evidenceClaims IDs")
        require_references(card_claims, set(ledger_claims), relationship="Scout Card evidence")
        for claim_id, claim in card_claims.items():
            ledger_claim = ledger_claims[claim_id]
            if claim["status"] != ledger_claim["status"] or set(claim["sourceIds"]) != set(
                ledger_claim["sourceIds"]
            ):
                raise SemanticContractError(
                    f"Scout Card claim {claim_id} changes its evidence classification"
                )

        full_by_id = {str(item["id"]): item for item in normalized_pathways}
        embedded_by_id = {str(item["id"]): item for item in assembled["pathways"]}
        expected_ids = {str(item) for item in assembled["pathwayIds"]}
        if set(full_by_id) != expected_ids or set(embedded_by_id) != expected_ids:
            raise SemanticContractError("card pathway IDs must exactly match versioned pathways")
        for pathway_id, full in full_by_id.items():
            projected = {
                key: value for key, value in full.items() if key not in {"projectId", "runId"}
            }
            if projected != embedded_by_id[pathway_id]:
                raise SemanticContractError(
                    f"embedded pathway {pathway_id} differs from its immutable version"
                )
        if set(assembled["industryLens"]["pathwayIds"]) != expected_ids:
            raise SemanticContractError("Industry Lens must compare the same three pathways")

        sources_by_id: dict[str, Mapping[str, Any]] = {
            str(source["id"]): source for source in sources
        }
        for claim in assembled["evidenceClaims"]:
            enforce_named_platform_proof(
                str(claim["statement"]),
                [str(item) for item in claim["sourceIds"]],
                sources_by_id,
            )
        return assembled


def has_useful_evidence(card: Mapping[str, Any] | None) -> bool:
    """Useful means a public claim is traceable to an available source."""
    if card is None:
        return False
    available = {
        str(source["id"])
        for source in card.get("sourceLedger", [])
        if source.get("availability") == "available"
    }
    return any(
        claim.get("status") in {"supported", "qualified", "conflicting"}
        and bool({str(item) for item in claim.get("sourceIds", [])} & available)
        for claim in card.get("evidenceClaims", [])
    )
