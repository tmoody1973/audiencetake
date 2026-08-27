"""Complete, partial, failed, and labeled-fallback publication policy."""

from __future__ import annotations

from collections.abc import Sequence
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from audience_take_agents.publication.assembler import ScoutCardAssembler, has_useful_evidence
from audience_take_agents.publication.errors import SemanticContractError
from audience_take_agents.publication.schema import validate_schema

FALLBACK_LABEL = "Previously generated — live refresh unavailable."
REQUIRED_SECTIONS = (
    "source_analysis",
    "web_research",
    "evidence",
    "pathways",
    "card",
)


@dataclass(frozen=True)
class PublicationCandidate:
    sources: tuple[dict[str, Any], ...]
    evidence_ledger: dict[str, Any] | None
    pathways: tuple[dict[str, Any], ...]
    card: dict[str, Any] | None


@dataclass(frozen=True)
class PublicationPlan:
    decision: dict[str, Any]
    sources: tuple[dict[str, Any], ...]
    pathways: tuple[dict[str, Any], ...]
    card: dict[str, Any] | None


class PublicationPolicy:
    """Turn durable stage output into one schema-valid publication decision."""

    def plan(
        self,
        candidate: PublicationCandidate,
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        attempt: int,
        published_at: datetime,
        missing_sections: Sequence[str] = (),
        previous_card_version_id: str | None = None,
    ) -> PublicationPlan:
        unique_missing = tuple(dict.fromkeys(missing_sections))
        valid_card: dict[str, Any] | None = None
        if (
            candidate.evidence_ledger is not None
            and candidate.card is not None
            and has_useful_evidence(candidate.card)
        ):
            proposed = deepcopy(candidate.card)
            proposed["runId"] = run_id
            proposed["projectId"] = project_id
            proposed["researchVersion"] = research_version
            proposed["publishedAt"] = published_at.isoformat().replace("+00:00", "Z")
            if unique_missing:
                proposed["completeness"] = "partial"
                proposed["missingSections"] = list(unique_missing)
            try:
                valid_card = ScoutCardAssembler().validate(
                    proposed,
                    evidence_ledger=candidate.evidence_ledger,
                    pathways=candidate.pathways,
                    sources=candidate.sources,
                )
            except SemanticContractError:
                valid_card = None

        if valid_card is None:
            failed_missing = unique_missing or REQUIRED_SECTIONS
            decision = self._decision(
                run_id=run_id,
                project_id=project_id,
                research_version=research_version,
                attempt=attempt,
                outcome="failed",
                useful_evidence=False,
                card_version_id=None,
                previous_card_version_id=previous_card_version_id,
                source_ids=(),
                claim_ids=(),
                pathway_ids=(),
                missing_sections=failed_missing,
                public_message=(
                    "Research did not produce enough useful sourced material to publish a card; "
                    "the nomination and run history remain available."
                ),
                fallback_used=False,
                published_at=published_at,
            )
            return PublicationPlan(decision=decision, sources=(), pathways=(), card=None)

        outcome = "partial" if valid_card["completeness"] == "partial" else "complete"
        decision = self._decision(
            run_id=run_id,
            project_id=project_id,
            research_version=research_version,
            attempt=attempt,
            outcome=outcome,
            useful_evidence=True,
            card_version_id=str(valid_card["cardVersionId"]),
            previous_card_version_id=previous_card_version_id,
            source_ids=tuple(str(item) for item in valid_card["sourceIds"]),
            claim_ids=tuple(str(item) for item in valid_card["claimIds"]),
            pathway_ids=tuple(str(item) for item in valid_card["pathwayIds"]),
            missing_sections=tuple(str(item) for item in valid_card["missingSections"]),
            public_message=(
                "A Partial Scout Card was published from useful sourced evidence; missing research "
                "remains explicit."
                if outcome == "partial"
                else "The Scout Card is published with sourced evidence, three hypotheses, and "
                "explicit limitations."
            ),
            fallback_used=False,
            published_at=published_at,
        )
        return PublicationPlan(
            decision=decision,
            sources=tuple(deepcopy(candidate.sources)),
            pathways=tuple(deepcopy(candidate.pathways)),
            card=valid_card,
        )

    def fallback_plan(
        self,
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        attempt: int,
        previous_card_version_id: str,
        published_at: datetime,
    ) -> PublicationPlan:
        decision = self._decision(
            run_id=run_id,
            project_id=project_id,
            research_version=research_version,
            attempt=attempt,
            outcome="failed",
            useful_evidence=False,
            card_version_id=None,
            previous_card_version_id=previous_card_version_id,
            source_ids=(),
            claim_ids=(),
            pathway_ids=(),
            missing_sections=("live_refresh",),
            public_message="The live refresh failed; the immutable previous card version remains available.",
            fallback_used=True,
            published_at=published_at,
        )
        return PublicationPlan(decision=decision, sources=(), pathways=(), card=None)

    @staticmethod
    def _decision(
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        attempt: int,
        outcome: str,
        useful_evidence: bool,
        card_version_id: str | None,
        previous_card_version_id: str | None,
        source_ids: Sequence[str],
        claim_ids: Sequence[str],
        pathway_ids: Sequence[str],
        missing_sections: Sequence[str],
        public_message: str,
        fallback_used: bool,
        published_at: datetime,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "publicationId": f"publication-{run_id}-v{research_version}-a{attempt}",
            "runId": run_id,
            "projectId": project_id,
            "researchVersion": research_version,
            "attempt": attempt,
            "outcome": outcome,
            "usefulEvidence": useful_evidence,
            "cardVersionId": card_version_id,
            "previousCardVersionId": previous_card_version_id,
            "sourceIds": list(source_ids),
            "claimIds": list(claim_ids),
            "pathwayIds": list(pathway_ids),
            "missingSections": list(missing_sections),
            "retryEligible": True,
            "publicMessage": public_message,
            "fallbackUsed": fallback_used,
            "publishedAt": published_at.isoformat().replace("+00:00", "Z"),
        }
        if fallback_used:
            payload["fallbackLabel"] = FALLBACK_LABEL
        validate_schema("card-publication.schema.json", payload)
        return payload
