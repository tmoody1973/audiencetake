"""Deterministic Evidence Editor support layer."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from audience_take_agents.publication.errors import SemanticContractError
from audience_take_agents.publication.project_profile import validate_project_profile
from audience_take_agents.publication.schema import validate_schema
from audience_take_agents.publication.truth import (
    enforce_named_platform_proof,
    require_references,
    values,
)


class EvidenceEditor:
    """Validate and normalize agent-authored evidence without inventing claims."""

    def edit(
        self,
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        sources: Sequence[dict[str, Any]],
        claims: Sequence[dict[str, Any]],
        comparables: Sequence[dict[str, Any]] = (),
        external_signals: Sequence[dict[str, Any]] = (),
        project_profile: Mapping[str, Any],
        limitations: Sequence[str],
        unresolved_questions: Sequence[str],
    ) -> dict[str, Any]:
        unique_sources, source_aliases = self._deduplicate_sources(sources)
        for source in unique_sources:
            validate_schema("source.schema.json", source)
            if source["runId"] != run_id or source["projectId"] != project_id:
                raise SemanticContractError("source identity does not match evidence ledger")

        source_ids = values(unique_sources, "id")
        normalized_profile = deepcopy(dict(project_profile))
        normalized_profile["sourceIds"] = list(
            dict.fromkeys(
                source_aliases.get(str(item), str(item))
                for item in normalized_profile.get("sourceIds", [])
            )
        )
        validate_project_profile(normalized_profile, available_source_ids=source_ids)
        sources_by_id: dict[str, Mapping[str, Any]] = {
            str(source["id"]): source for source in unique_sources
        }
        normalized_claims: list[dict[str, Any]] = []
        for original in claims:
            claim = deepcopy(original)
            claim.setdefault("qualification", None)
            claim["sourceIds"] = list(
                dict.fromkeys(
                    source_aliases.get(str(item), str(item)) for item in claim["sourceIds"]
                )
            )
            schema_claim = {
                key: value
                for key, value in claim.items()
                if key != "qualification" or value is not None
            }
            validate_schema("evidence-claim.schema.json", schema_claim)
            claim_source_ids = [str(item) for item in claim["sourceIds"]]
            require_references(
                claim_source_ids,
                source_ids,
                relationship=f"claim {claim['id']}",
            )
            status = str(claim["status"])
            if status in {"supported", "qualified", "conflicting"} and not claim_source_ids:
                raise SemanticContractError(f"{status} claim {claim['id']} requires a source")
            if status in {"qualified", "conflicting", "unsupported", "inference"} and not claim.get(
                "qualification"
            ):
                raise SemanticContractError(
                    f"{status} claim {claim['id']} requires a qualification"
                )
            if status == "supported" and not any(
                sources_by_id[source_id].get("availability") == "available"
                and sources_by_id[source_id].get("verificationStatus") in {"observed", "verified"}
                for source_id in claim_source_ids
            ):
                raise SemanticContractError(
                    f"supported claim {claim['id']} lacks available observed or verified evidence"
                )
            if status == "conflicting" and not any(
                str(claim["id"])
                in {str(item) for item in sources_by_id[source_id]["conflictsWithClaimIds"]}
                for source_id in claim_source_ids
            ):
                raise SemanticContractError(
                    f"conflicting claim {claim['id']} has no source declaring that conflict"
                )
            enforce_named_platform_proof(str(claim["statement"]), claim_source_ids, sources_by_id)
            normalized_claims.append(claim)

        claim_ids = values(normalized_claims, "id")
        if len(claim_ids) != len(normalized_claims):
            raise SemanticContractError("claim IDs must be unique")
        normalized_comparables = deepcopy(list(comparables))
        for comparable in normalized_comparables:
            comparable["sourceIds"] = list(
                dict.fromkeys(
                    source_aliases.get(str(item), str(item)) for item in comparable["sourceIds"]
                )
            )
            require_references(
                (str(item) for item in comparable["sourceIds"]),
                source_ids,
                relationship=f"comparable {comparable['id']}",
            )
        normalized_signals = deepcopy(list(external_signals))
        for signal in normalized_signals:
            signal["sourceIds"] = list(
                dict.fromkeys(
                    source_aliases.get(str(item), str(item)) for item in signal["sourceIds"]
                )
            )
            require_references(
                (str(item) for item in signal["sourceIds"]),
                source_ids,
                relationship=f"external signal {signal['id']}",
            )
            if signal.get("nativeAudienceCount") is not False:
                raise SemanticContractError("external signals cannot become native audience counts")

        assessments = [self._assessment(source, claim_ids) for source in unique_sources]
        ledger: dict[str, Any] = {
            "runId": run_id,
            "projectId": project_id,
            "researchVersion": research_version,
            "projectProfile": normalized_profile,
            "claims": normalized_claims,
            "comparables": normalized_comparables,
            "externalSignals": normalized_signals,
            "sourceAssessments": assessments,
            "evidenceQuality": self._quality(unique_sources, normalized_claims),
            "limitations": list(dict.fromkeys(limitations)),
            "unresolvedQuestions": list(dict.fromkeys(unresolved_questions)),
        }
        validate_schema("evidence-ledger.schema.json", ledger)
        return ledger

    @staticmethod
    def _deduplicate_sources(
        sources: Sequence[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], dict[str, str]]:
        by_url: dict[str, dict[str, Any]] = {}
        ids: set[str] = set()
        aliases: dict[str, str] = {}
        for original in sources:
            source = deepcopy(original)
            source_id = str(source["id"])
            canonical_url = str(source["canonicalUrl"])
            if source_id in ids:
                raise SemanticContractError(f"source ID {source_id} is duplicated")
            ids.add(source_id)
            if canonical_url in by_url:
                existing = by_url[canonical_url]
                aliases[source_id] = str(existing["id"])
                existing["supportsClaimIds"] = sorted(
                    set(existing["supportsClaimIds"]) | set(source["supportsClaimIds"])
                )
                existing["conflictsWithClaimIds"] = sorted(
                    set(existing["conflictsWithClaimIds"]) | set(source["conflictsWithClaimIds"])
                )
                continue
            by_url[canonical_url] = source
            aliases[source_id] = source_id
        return list(by_url.values()), aliases

    @staticmethod
    def _assessment(source: Mapping[str, Any], claim_ids: set[str]) -> dict[str, Any]:
        linked = sorted(
            (
                {str(item) for item in source["supportsClaimIds"]}
                | {str(item) for item in source["conflictsWithClaimIds"]}
            )
            & claim_ids
        )
        if source["conflictsWithClaimIds"]:
            assessment = "conflicting"
        elif source["externalCommentary"]:
            assessment = "external_commentary"
        elif source["sourceType"] == "comparable":
            assessment = "comparable"
        elif source["origin"] == "submitted":
            assessment = "primary_submitted"
        elif linked:
            assessment = "corroborating"
        else:
            assessment = "insufficient"
        return {"sourceId": source["id"], "assessment": assessment, "claimIds": linked}

    @staticmethod
    def _quality(sources: Sequence[Mapping[str, Any]], claims: Sequence[Mapping[str, Any]]) -> str:
        supported = sum(claim["status"] == "supported" for claim in claims)
        independent = sum(source["origin"] == "parallel" for source in sources)
        if supported >= 3 and independent >= 3:
            return "substantial"
        if supported >= 1 and independent >= 1:
            return "developing"
        return "limited"
