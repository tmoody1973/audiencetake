"""Publication service facade for orchestrator integration."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from audience_take_agents.publication.policy import (
    PublicationCandidate,
    PublicationPlan,
    PublicationPolicy,
)
from audience_take_agents.publication.store import FailureStage, PublicationStore


class ScoutCardPublisher:
    def __init__(self, store: PublicationStore, policy: PublicationPolicy | None = None) -> None:
        self._store = store
        self._policy = policy or PublicationPolicy()

    def publish(
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
        failure_at: FailureStage | None = None,
    ) -> tuple[dict[str, Any], bool]:
        plan = self._policy.plan(
            candidate,
            run_id=run_id,
            project_id=project_id,
            research_version=research_version,
            attempt=attempt,
            published_at=published_at,
            missing_sections=missing_sections,
            previous_card_version_id=previous_card_version_id,
        )
        return plan.decision, self._commit(plan, failure_at)

    def record_labeled_fallback(
        self,
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        attempt: int,
        previous_card_version_id: str,
        published_at: datetime,
    ) -> tuple[dict[str, Any], bool]:
        plan = self._policy.fallback_plan(
            run_id=run_id,
            project_id=project_id,
            research_version=research_version,
            attempt=attempt,
            previous_card_version_id=previous_card_version_id,
            published_at=published_at,
        )
        return plan.decision, self._commit(plan, None)

    def _commit(self, plan: PublicationPlan, failure_at: FailureStage | None) -> bool:
        return self._store.commit(
            plan.decision,
            sources=plan.sources,
            pathways=plan.pathways,
            card=plan.card,
            failure_at=failure_at,
        )
