from __future__ import annotations

from typing import Any

import pytest
from scripts.deployed_smoke import publication_reconciliation_blocker, retry_blocker


def run_state(**overrides: Any) -> dict[str, Any]:
    state = {
        "status": "queued",
        "parallelRequestCount": 0,
        "sourceCount": 0,
        "completedStages": [1, 2],
        "currentStage": 3,
        "researchVersion": 1,
    }
    state.update(overrides)
    return state


def stage_output(stage: int, *, research_version: int = 1) -> dict[str, Any]:
    return {"stage": stage, "researchVersion": research_version}


@pytest.mark.parametrize(
    ("state", "outputs"),
    [
        (
            run_state(),
            [stage_output(1), stage_output(2)],
        ),
        (
            run_state(completedStages=[], currentStage=1),
            [],
        ),
    ],
)
def test_retry_blocker_allows_only_safe_pre_provider_progress(
    state: dict[str, Any], outputs: list[dict[str, Any]]
) -> None:
    assert retry_blocker(state, outputs) is None


def test_retry_blocker_allows_explicit_post_provider_continuation() -> None:
    state = run_state(
        parallelRequestCount=1,
        sourceCount=9,
        completedStages=[1, 2, 3],
        currentStage=4,
    )

    assert retry_blocker(
        state,
        [stage_output(1), stage_output(2), stage_output(3)],
        allow_provider_proof=True,
    ) is None


def test_post_provider_continuation_allows_retry_eligible_failed_publication() -> None:
    state = run_state(
        status="failed",
        parallelRequestCount=1,
        sourceCount=9,
        completedStages=[1, 2, 3, 4, 5],
        currentStage=6,
    )
    public_run = {
        "status": "failed",
        "retryEligible": True,
        "completedStages": [1, 2, 3, 4, 5],
        "currentStage": 6,
        "researchVersion": 1,
    }

    assert retry_blocker(
        state,
        [stage_output(stage) for stage in range(1, 6)],
        allow_provider_proof=True,
        allow_failed_publication=True,
        public_run=public_run,
    ) is None


def test_failed_publication_continuation_requires_public_retry_eligibility() -> None:
    state = run_state(
        status="failed",
        parallelRequestCount=1,
        sourceCount=9,
        completedStages=[1, 2, 3, 4, 5],
        currentStage=6,
    )

    assert "retry-eligible failed publication" in (
        retry_blocker(
            state,
            [stage_output(stage) for stage in range(1, 6)],
            allow_provider_proof=True,
            allow_failed_publication=True,
            public_run={"status": "failed", "retryEligible": False},
        )
        or ""
    )


def test_post_provider_continuation_requires_proof_and_stage_three() -> None:
    no_proof = run_state(completedStages=[1, 2, 3], currentStage=4)
    no_stage_three = run_state(
        parallelRequestCount=1,
        sourceCount=9,
        completedStages=[1, 2],
        currentStage=3,
    )

    assert "requires durable provider proof" in (
        retry_blocker(
            no_proof,
            [stage_output(1), stage_output(2), stage_output(3)],
            allow_provider_proof=True,
        )
        or ""
    )
    assert "requires durable stage 3" in (
        retry_blocker(
            no_stage_three,
            [stage_output(1), stage_output(2)],
            allow_provider_proof=True,
        )
        or ""
    )


@pytest.mark.parametrize(
    ("state", "outputs", "message"),
    [
        (run_state(parallelRequestCount=1), [], "Parallel request proof"),
        (run_state(sourceCount=1), [], "provider sources"),
        (
            run_state(completedStages=[1, 2, 3], currentStage=4),
            [stage_output(1), stage_output(2), stage_output(3)],
            "stage 3 or later",
        ),
        (run_state(), [stage_output(1)], "do not match"),
        (
            run_state(),
            [stage_output(1), stage_output(2, research_version=2)],
            "another research version",
        ),
    ],
)
def test_retry_blocker_rejects_unsafe_or_inconsistent_progress(
    state: dict[str, Any], outputs: list[dict[str, Any]], message: str
) -> None:
    assert message in (retry_blocker(state, outputs) or "")


def test_publication_reconciliation_requires_a_complete_atomic_commit() -> None:
    run = run_state(
        runId="run-01",
        status="queued",
        attemptCount=15,
        leaseOwner=None,
        completedStages=[1, 2, 3, 4, 5],
        currentStage=6,
        lastEventSequence=6,
    )
    public_run = {
        "status": "queued",
        "attempt": 15,
        "researchVersion": 1,
        "completedStages": [1, 2, 3, 4, 5],
        "currentStage": 6,
    }
    publication = {
        "publicationId": "publication-run-01-v1-a15",
        "attempt": 15,
        "researchVersion": 1,
        "outcome": "complete",
        "usefulEvidence": True,
        "missingSections": [],
        "cardVersionId": "card-project-01-v1",
        "sourceIds": [f"source-{index}" for index in range(10)],
        "pathwayIds": ["pathway-series", "pathway-feature", "pathway-creator-direct"],
    }
    project = {
        "publicationStatus": "published",
        "cardCompleteness": "complete",
        "publishedResearchVersion": 1,
        "latestCardVersionId": "card-project-01-v1",
    }

    assert (
        publication_reconciliation_blocker(
            run,
            public_run,
            project,
            publication,
            card_exists=True,
            sources_exist=True,
            pathways_exist=True,
            terminal_event_exists=False,
        )
        is None
    )
    assert "three published pathways" in (
        publication_reconciliation_blocker(
            run,
            public_run,
            project,
            publication,
            card_exists=True,
            sources_exist=True,
            pathways_exist=False,
            terminal_event_exists=False,
        )
        or ""
    )
