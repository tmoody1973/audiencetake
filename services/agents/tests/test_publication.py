from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from audience_take_agents.publication import (
    FALLBACK_LABEL,
    EvidenceEditor,
    ImmutableVersionError,
    InMemoryPublicationStore,
    PathwayStrategist,
    PublicationCandidate,
    PublicationConflictError,
    PublicationWriteError,
    ScoutCardPublisher,
    SemanticContractError,
)

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "contracts" / "fixtures"
NOW = datetime(2026, 8, 26, 12, 5, tzinfo=UTC)


def fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def make_candidate(*, version: int = 1, run_id: str = "run-junichiro-v1") -> PublicationCandidate:
    source = fixture("junichiro-source.json")
    ledger = fixture("junichiro-evidence-ledger.json")
    card = fixture("junichiro-card.json")
    source["runId"] = run_id
    ledger["runId"] = run_id
    ledger["researchVersion"] = version
    card["runId"] = run_id
    card["researchVersion"] = version
    card["cardVersionId"] = f"card-junichiro-v{version}"
    pathways: list[dict[str, Any]] = []
    for embedded in card["pathways"]:
        full = deepcopy(embedded)
        full["projectId"] = card["projectId"]
        full["runId"] = run_id
        pathways.append(full)
    return PublicationCandidate(
        sources=(source,),
        evidence_ledger=ledger,
        pathways=tuple(pathways),
        card=card,
    )


def publish(
    store: InMemoryPublicationStore,
    candidate: PublicationCandidate | None = None,
    *,
    version: int = 1,
    run_id: str = "run-junichiro-v1",
    missing_sections: tuple[str, ...] = (),
    failure_at: str | None = None,
    attempt: int = 1,
) -> tuple[dict[str, Any], bool]:
    return ScoutCardPublisher(store).publish(
        candidate or make_candidate(version=version, run_id=run_id),
        run_id=run_id,
        project_id="junichiro-jackson",
        research_version=version,
        attempt=attempt,
        published_at=NOW,
        missing_sections=missing_sections,
        failure_at=failure_at,  # type: ignore[arg-type]
    )


def test_evidence_editor_accepts_supported_qualified_and_conflicting_claims() -> None:
    source = fixture("junichiro-source.json")
    qualified = fixture("junichiro-claim.json")
    supported = deepcopy(qualified)
    supported.update(id="claim-supported", status="supported", qualification=None)
    source["verificationStatus"] = "observed"
    source["supportsClaimIds"].append("claim-supported")
    conflicting = deepcopy(qualified)
    conflicting.update(
        id="claim-conflict",
        status="conflicting",
        qualification="Two public records disagree; no resolution is asserted.",
    )
    source["conflictsWithClaimIds"].append("claim-conflict")

    ledger = EvidenceEditor().edit(
        run_id=source["runId"],
        project_id=source["projectId"],
        research_version=1,
        sources=[source],
        claims=[qualified, supported, conflicting],
        limitations=["Public evidence remains bounded."],
        unresolved_questions=["Which account is current?"],
    )

    assert [claim["status"] for claim in ledger["claims"]] == [
        "qualified",
        "supported",
        "conflicting",
    ]
    assert ledger["sourceAssessments"][0]["assessment"] == "conflicting"


def test_evidence_editor_rejects_missing_evidence_and_overstated_platform_interest() -> None:
    source = fixture("junichiro-source.json")
    claim = fixture("junichiro-claim.json")
    missing = deepcopy(claim)
    missing["sourceIds"] = ["source-does-not-exist"]

    with pytest.raises(SemanticContractError, match="missing IDs"):
        EvidenceEditor().edit(
            run_id=source["runId"],
            project_id=source["projectId"],
            research_version=1,
            sources=[source],
            claims=[missing],
            limitations=["Missing source."],
            unresolved_questions=["Can this be verified?"],
        )

    claim["statement"] = "Netflix is interested in acquiring the project."
    with pytest.raises(SemanticContractError, match="named platforms"):
        EvidenceEditor().edit(
            run_id=source["runId"],
            project_id=source["projectId"],
            research_version=1,
            sources=[source],
            claims=[claim],
            limitations=["No platform confirmation."],
            unresolved_questions=["Has anyone expressed interest?"],
        )


def test_evidence_editor_deduplicates_canonical_urls_without_losing_claim_coverage() -> None:
    source = fixture("junichiro-source.json")
    duplicate = deepcopy(source)
    duplicate["id"] = "source-duplicate"
    duplicate["supportsClaimIds"] = ["claim-second"]
    claim = fixture("junichiro-claim.json")
    claim["sourceIds"] = ["source-duplicate"]
    ledger = EvidenceEditor().edit(
        run_id=source["runId"],
        project_id=source["projectId"],
        research_version=1,
        sources=[source, duplicate],
        claims=[claim],
        limitations=["One canonical public source."],
        unresolved_questions=["What independent source corroborates this?"],
    )
    assert len(ledger["sourceAssessments"]) == 1
    assert ledger["claims"][0]["sourceIds"] == ["source-youtube-trailer"]


def test_pathway_strategist_requires_three_distinct_evidence_linked_paths() -> None:
    candidate = make_candidate()
    assert candidate.evidence_ledger is not None
    valid = PathwayStrategist().validate(
        candidate.pathways,
        evidence_ledger=candidate.evidence_ledger,
        sources=candidate.sources,
    )
    assert {pathway["order"] for pathway in valid} == {1, 2, 3}
    assert {pathway["label"] for pathway in valid} == {
        "Premium adult animated series",
        "Independent animated feature",
        "Creator-direct serialized franchise",
    }

    duplicate = [deepcopy(pathway) for pathway in candidate.pathways]
    duplicate[1]["format"] = duplicate[0]["format"]
    with pytest.raises(SemanticContractError, match="format values must be distinct"):
        PathwayStrategist().validate(
            duplicate,
            evidence_ledger=candidate.evidence_ledger,
            sources=candidate.sources,
        )


def test_pathway_cannot_rely_on_unsupported_or_unproven_platform_claims() -> None:
    candidate = make_candidate()
    assert candidate.evidence_ledger is not None
    unsupported = deepcopy(candidate.evidence_ledger)
    unsupported["claims"][0]["status"] = "unsupported"
    unsupported["claims"][0]["qualification"] = "No usable proof."
    with pytest.raises(SemanticContractError, match="unsupported evidence"):
        PathwayStrategist().validate(
            candidate.pathways,
            evidence_ledger=unsupported,
            sources=candidate.sources,
        )

    overstated = [deepcopy(pathway) for pathway in candidate.pathways]
    overstated[0]["rationale"] = "Netflix is interested in acquiring this series."
    with pytest.raises(SemanticContractError, match="named platforms"):
        PathwayStrategist().validate(
            overstated,
            evidence_ledger=candidate.evidence_ledger,
            sources=candidate.sources,
        )


def test_policy_publishes_complete_partial_and_failed_honestly() -> None:
    complete_store = InMemoryPublicationStore()
    complete, created = publish(complete_store)
    assert created is True
    assert complete["outcome"] == "complete"
    assert complete["usefulEvidence"] is True
    assert complete_store.pointer("junichiro-jackson") is not None

    partial_store = InMemoryPublicationStore()
    partial, created = publish(
        partial_store, missing_sections=("parallel_web_sources", "verified_comparables")
    )
    assert created is True
    assert partial["outcome"] == "partial"
    assert partial["missingSections"] == ["parallel_web_sources", "verified_comparables"]
    partial_card = partial_store.card(str(partial["cardVersionId"]))
    assert partial_card is not None and partial_card["completeness"] == "partial"

    failed_store = InMemoryPublicationStore()
    failed, created = publish(
        failed_store,
        PublicationCandidate(sources=(), evidence_ledger=None, pathways=(), card=None),
    )
    assert created is True
    assert failed["outcome"] == "failed"
    assert failed["usefulEvidence"] is False
    assert failed["cardVersionId"] is None
    assert failed_store.pointer("junichiro-jackson") is None


def test_successful_attempt_preserves_a_prior_failed_publication_decision() -> None:
    store = InMemoryPublicationStore()
    failed, failed_created = publish(
        store,
        PublicationCandidate(sources=(), evidence_ledger=None, pathways=(), card=None),
        attempt=13,
    )

    complete, complete_created = publish(store, attempt=14)

    assert failed_created is True
    assert complete_created is True
    assert failed["publicationId"] != complete["publicationId"]
    assert store.publication(str(failed["publicationId"])) == failed
    assert store.publication(str(complete["publicationId"])) == complete
    assert store.pointer("junichiro-jackson") is not None


@pytest.mark.parametrize(
    "missing_section",
    ["source_analysis", "web_research", "evidence", "pathways", "card"],
)
def test_each_pipeline_failure_is_labeled_on_a_useful_partial_card(
    missing_section: str,
) -> None:
    store = InMemoryPublicationStore()
    decision, created = publish(store, missing_sections=(missing_section,))
    assert created is True
    assert decision["outcome"] == "partial"
    assert decision["usefulEvidence"] is True
    assert decision["missingSections"] == [missing_section]


def test_previously_generated_card_cannot_enter_the_live_publication_path() -> None:
    candidate = make_candidate()
    assert candidate.card is not None
    candidate.card["fallbackUsed"] = True
    candidate.card["fallbackLabel"] = FALLBACK_LABEL
    decision, created = publish(InMemoryPublicationStore(), candidate)
    assert created is True
    assert decision["outcome"] == "failed"
    assert decision["fallbackUsed"] is False
    assert decision["cardVersionId"] is None


@pytest.mark.parametrize("stage", ["sources", "pathways", "card", "publication", "pointer"])
def test_failure_injection_rolls_back_every_atomic_publication_stage(stage: str) -> None:
    store = InMemoryPublicationStore()
    with pytest.raises(PublicationWriteError, match=stage):
        publish(store, failure_at=stage)

    assert store.pointer("junichiro-jackson") is None
    assert store.card("card-junichiro-v1") is None
    assert store.publication("publication-run-junichiro-v1-v1-a1") is None
    assert store.source("junichiro-jackson", 1, "source-youtube-trailer") is None


def test_publication_is_idempotent_and_prior_versions_remain_immutable() -> None:
    store = InMemoryPublicationStore()
    decision, created = publish(store)
    assert created is True
    replay, created = publish(store)
    assert replay == decision
    assert created is False

    old_card = store.card("card-junichiro-v1")
    v2, created = publish(
        store,
        make_candidate(version=2, run_id="run-junichiro-v2"),
        version=2,
        run_id="run-junichiro-v2",
    )
    assert created is True
    assert store.pointer("junichiro-jackson") is not None
    assert store.pointer("junichiro-jackson").card_version_id == v2["cardVersionId"]  # type: ignore[union-attr]
    assert store.card("card-junichiro-v1") == old_card
    assert store.source("junichiro-jackson", 1, "source-youtube-trailer") is not None
    assert store.pathway("junichiro-jackson", 1, "pathway-series") is not None

    stale = deepcopy(decision)
    stale["publicationId"] = "publication-stale"
    with pytest.raises(ImmutableVersionError):
        store.commit(
            stale,
            sources=make_candidate().sources,
            pathways=make_candidate().pathways,
            card=make_candidate().card,
        )


def test_changed_idempotent_publication_is_rejected() -> None:
    store = InMemoryPublicationStore()
    decision, _ = publish(store)
    changed = deepcopy(decision)
    changed["publicMessage"] = "Changed during replay."
    with pytest.raises(PublicationConflictError, match="different content"):
        store.commit(changed, sources=(), pathways=(), card=None)

    candidate = make_candidate()
    changed_source = deepcopy(candidate.sources[0])
    changed_source["title"] = "Mutated replay"
    with pytest.raises(PublicationConflictError, match="different content"):
        store.commit(
            decision,
            sources=(changed_source,),
            pathways=candidate.pathways,
            card=candidate.card,
        )


def test_retry_reservations_are_versioned_idempotent_and_compare_the_pointer() -> None:
    store = InMemoryPublicationStore()
    first = store.reserve_retry(
        idempotency_key="retry-request-1",
        project_id="junichiro-jackson",
        run_id="run-junichiro-v1",
        expected_previous_version=None,
        attempt=1,
    )
    replay = store.reserve_retry(
        idempotency_key="retry-request-1",
        project_id="junichiro-jackson",
        run_id="run-junichiro-v1",
        expected_previous_version=None,
        attempt=1,
    )
    assert replay == first
    assert first.research_version == 1

    with pytest.raises(PublicationConflictError, match="another idempotency key"):
        store.reserve_retry(
            idempotency_key="retry-request-2",
            project_id="junichiro-jackson",
            run_id="run-junichiro-other",
            expected_previous_version=None,
            attempt=1,
        )


def test_fallback_is_exactly_labeled_and_never_replaces_the_live_pointer() -> None:
    store = InMemoryPublicationStore()
    publish(store)
    old_pointer = store.pointer("junichiro-jackson")
    decision, created = ScoutCardPublisher(store).record_labeled_fallback(
        run_id="run-junichiro-refresh-v2",
        project_id="junichiro-jackson",
        research_version=2,
        attempt=3,
        previous_card_version_id="card-junichiro-v1",
        published_at=NOW,
    )
    assert created is True
    assert decision["outcome"] == "failed"
    assert decision["fallbackUsed"] is True
    assert decision["fallbackLabel"] == FALLBACK_LABEL
    assert decision["cardVersionId"] is None
    assert store.pointer("junichiro-jackson") == old_pointer
