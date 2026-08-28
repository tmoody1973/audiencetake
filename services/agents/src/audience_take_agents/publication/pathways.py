"""Pathway Strategist semantic contract."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from audience_take_agents.publication.errors import SemanticContractError
from audience_take_agents.publication.project_profile import validate_project_profile
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
        profile = evidence_ledger.get("projectProfile")
        if not isinstance(profile, Mapping):
            raise SemanticContractError("pathway validation requires a project profile")
        source_ids = {str(source["id"]) for source in sources}
        validate_project_profile(profile, available_source_ids=source_ids)
        native_medium = str(profile["medium"])
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
        for field in ("id", "label", "format", "strategyKind"):
            normalized = {str(pathway[field]).strip().casefold() for pathway in copies}
            if len(normalized) != 3:
                raise SemanticContractError(f"all three pathway {field} values must be distinct")

        claims_by_id = {str(claim["id"]): claim for claim in evidence_ledger["claims"]}
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
            self._validate_medium_compatibility(
                pathway,
                native_medium=native_medium,
                claims_by_id=claims_by_id,
                supporting_ids=set(supporting_ids),
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

    @staticmethod
    def _validate_medium_compatibility(
        pathway: Mapping[str, Any],
        *,
        native_medium: str,
        claims_by_id: Mapping[str, Mapping[str, Any]],
        supporting_ids: set[str],
    ) -> None:
        proposed_medium = str(pathway.get("proposedMedium", ""))
        cross_format = pathway.get("crossFormat")
        cross_claim_ids = [str(item) for item in pathway.get("crossFormatClaimIds", [])]
        strategy_kind = str(pathway.get("strategyKind", ""))
        if proposed_medium not in {
            "documentary",
            "live_action",
            "animation",
            "hybrid",
            "unknown",
        }:
            raise SemanticContractError(f"pathway {pathway['id']} has an invalid proposed medium")
        if not isinstance(cross_format, bool):
            raise SemanticContractError(f"pathway {pathway['id']} requires crossFormat")

        changes_medium = proposed_medium != native_medium
        if native_medium == "unknown" and proposed_medium != "unknown":
            raise SemanticContractError("unknown-medium projects require medium-neutral pathways")
        if changes_medium:
            if cross_format is not True or strategy_kind != "adaptation":
                raise SemanticContractError(
                    f"pathway {pathway['id']} changes medium without explicit adaptation status"
                )
            if not cross_claim_ids:
                raise SemanticContractError(
                    f"pathway {pathway['id']} cross-format adaptation requires qualified evidence"
                )
            require_references(
                cross_claim_ids,
                set(claims_by_id),
                relationship=f"pathway {pathway['id']} cross-format claim",
            )
            if not set(cross_claim_ids).issubset(supporting_ids):
                raise SemanticContractError(
                    f"pathway {pathway['id']} cross-format claims must also support the pathway"
                )
            if any(claims_by_id[claim_id]["status"] != "qualified" for claim_id in cross_claim_ids):
                raise SemanticContractError(
                    f"pathway {pathway['id']} cross-format adaptation requires qualified evidence"
                )
        elif cross_format or cross_claim_ids:
            raise SemanticContractError(
                f"pathway {pathway['id']} cannot mark a native-medium direction cross-format"
            )

        mentioned = _mentioned_media(f"{pathway['label']} {pathway['format']}")
        allowed = (
            {"documentary", "live_action", "animation"}
            if proposed_medium == "hybrid"
            else {proposed_medium}
        )
        contradictions = mentioned - allowed
        if contradictions:
            raise SemanticContractError(
                f"pathway {pathway['id']} label or format contradicts proposed medium"
            )


def _mentioned_media(text: str) -> set[str]:
    normalized = text.casefold()
    mentions: set[str] = set()
    if re.search(r"\b(?:documentary|non[ -]?fiction)\b", normalized):
        mentions.add("documentary")
    if re.search(r"\b(?:animat(?:ed|ion)|anime)\b", normalized):
        mentions.add("animation")
    if re.search(r"\b(?:live[ -]?action|scripted)\b", normalized):
        mentions.add("live_action")
    return mentions
