"""Pathway Strategist semantic contract."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from audience_take_agents.publication.errors import SemanticContractError
from audience_take_agents.publication.schema import validate_schema
from audience_take_agents.publication.truth import enforce_named_platform_proof, require_references


class PathwayStrategist:
    """Accept exactly three distinct, evidence-linked pathway hypotheses."""

    def validate(
        self,
        pathways: Sequence[dict[str, Any]],
        *,
        evidence_ledger: Mapping[str, Any],
        sources: Sequence[Mapping[str, Any]],
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        if len(pathways) != 3:
            raise SemanticContractError("a Scout Card requires exactly three pathways")
        copies = (
            deepcopy(pathways[0]),
            deepcopy(pathways[1]),
            deepcopy(pathways[2]),
        )
        for pathway in copies:
            validate_schema("pathway.schema.json", pathway)
            if (
                pathway["projectId"] != evidence_ledger["projectId"]
                or pathway["runId"] != evidence_ledger["runId"]
            ):
                raise SemanticContractError("pathway identity does not match the evidence ledger")
        if {int(pathway["order"]) for pathway in copies} != {1, 2, 3}:
            raise SemanticContractError("pathway order must contain 1, 2, and 3 exactly once")
        for field in ("id", "label", "format"):
            normalized = {str(pathway[field]).strip().casefold() for pathway in copies}
            if len(normalized) != 3:
                raise SemanticContractError(f"all three pathway {field} values must be distinct")

        claims_by_id = {str(claim["id"]): claim for claim in evidence_ledger["claims"]}
        source_ids = {str(source["id"]) for source in sources}
        sources_by_id = {str(source["id"]): source for source in sources}
        for pathway in copies:
            supporting_ids = [str(item) for item in pathway["supportingClaimIds"]]
            require_references(
                supporting_ids,
                set(claims_by_id),
                relationship=f"pathway {pathway['id']} claim",
            )
            if any(
                claims_by_id[claim_id]["status"] == "unsupported" for claim_id in supporting_ids
            ):
                raise SemanticContractError(
                    f"pathway {pathway['id']} cannot rely on unsupported evidence"
                )
            require_references(
                (str(item) for item in pathway["comparableSourceIds"]),
                source_ids,
                relationship=f"pathway {pathway['id']} comparable",
            )
            linked_source_ids = sorted(
                {
                    str(source_id)
                    for claim_id in supporting_ids
                    for source_id in claims_by_id[claim_id]["sourceIds"]
                }
            )
            pathway_text = " ".join(
                [
                    str(pathway["label"]),
                    str(pathway["rationale"]),
                    *[str(item) for item in pathway["strengths"]],
                ]
            )
            enforce_named_platform_proof(pathway_text, linked_source_ids, sources_by_id)
        return copies
