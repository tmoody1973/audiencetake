"""Persistence contract plus deterministic in-memory implementation."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from threading import RLock
from typing import Protocol

from audience_take_agents.runtime.models import (
    LeaseDisposition,
    LeaseResult,
    PublicEvent,
    PublicRunProjection,
    ResearchTaskRequest,
    RunStatus,
    StageOutput,
)


class RuntimeConflictError(RuntimeError):
    """Raised when a deterministic write is replayed with different content."""


class LeaseLostError(RuntimeError):
    """Raised when a worker writes after losing its lease."""


class RuntimeStore(Protocol):
    def acquire_lease(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LeaseResult: ...

    def heartbeat(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
        stage: int | None = None,
    ) -> None: ...

    def persist_stage(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        output: StageOutput,
        event: PublicEvent,
        now: datetime,
        lease_duration: timedelta,
    ) -> bool: ...

    def load_stage_output(
        self, task: ResearchTaskRequest, stage: int
    ) -> StageOutput | None: ...

    def record_provider_success(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        request_count: int,
        source_count: int,
        now: datetime,
    ) -> None: ...

    def next_event_sequence(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
    ) -> int: ...

    def finish(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        status: RunStatus,
        event: PublicEvent,
        now: datetime,
    ) -> bool: ...

    def release_for_retry(
        self, task: ResearchTaskRequest, worker_id: str, now: datetime
    ) -> None: ...


@dataclass
class _RunState:
    project_id: str
    attempt: int
    research_version: int
    status: RunStatus = RunStatus.QUEUED
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    current_stage: int = 1
    completed_stages: list[int] = field(default_factory=list)
    missing_stages: list[int] = field(default_factory=list)
    last_sequence: int = 0
    project_slug: str | None = None
    card_url: str | None = None
    public_failure_message: str | None = None
    retry_eligible: bool = False
    fallback_used: bool = False
    fallback_label: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.fromtimestamp(0, UTC))
    provider_request_count: int = 0
    provider_source_count: int = 0
    last_provider_success_at: datetime | None = None


class InMemoryRuntimeStore:
    """Thread-safe fake with the same idempotency boundaries as Firestore."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._runs: dict[str, _RunState] = {}
        self._events: dict[str, PublicEvent] = {}
        self._outputs: dict[tuple[str, str], StageOutput] = {}

    def seed_run(
        self,
        task: ResearchTaskRequest,
        *,
        status: RunStatus = RunStatus.QUEUED,
        lease_owner: str | None = None,
        lease_expires_at: datetime | None = None,
        project_slug: str | None = "project-01",
        card_url: str | None = "/projects/project-01",
        fallback_used: bool = False,
        fallback_label: str | None = None,
        current_stage: int = 1,
        completed_stages: tuple[int, ...] = (),
        last_sequence: int = 0,
    ) -> None:
        with self._lock:
            self._runs[task.run_id] = _RunState(
                project_id=task.project_id,
                attempt=task.attempt,
                research_version=task.research_version,
                status=status,
                lease_owner=lease_owner,
                lease_expires_at=lease_expires_at,
                project_slug=project_slug,
                card_url=card_url,
                fallback_used=fallback_used,
                fallback_label=fallback_label,
                current_stage=current_stage,
                completed_stages=list(completed_stages),
                last_sequence=last_sequence,
            )

    def acquire_lease(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LeaseResult:
        with self._lock:
            run = self._require_run(task.run_id)
            if run.project_id != task.project_id:
                return LeaseResult(disposition=LeaseDisposition.SUPERSEDED)
            if run.status in {RunStatus.COMPLETE, RunStatus.PARTIAL, RunStatus.FAILED}:
                return LeaseResult(disposition=LeaseDisposition.COMPLETE)
            if task.attempt != run.attempt or task.research_version != run.research_version:
                return LeaseResult(disposition=LeaseDisposition.SUPERSEDED)

            healthy = run.lease_expires_at is not None and run.lease_expires_at > now
            if healthy and run.lease_owner != worker_id:
                return LeaseResult(
                    disposition=LeaseDisposition.HEALTHY_OWNER,
                    lease_owner=run.lease_owner,
                    lease_expires_at=run.lease_expires_at,
                )
            if healthy:
                disposition = LeaseDisposition.RENEWED
            elif run.lease_owner is not None:
                disposition = LeaseDisposition.RECLAIMED
            else:
                disposition = LeaseDisposition.ACQUIRED

            run.status = RunStatus.RUNNING
            run.lease_owner = worker_id
            run.lease_expires_at = now + lease_duration
            run.last_heartbeat_at = now
            run.updated_at = now
            return LeaseResult(
                disposition=disposition,
                lease_owner=worker_id,
                lease_expires_at=run.lease_expires_at,
            )

    def heartbeat(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
        stage: int | None = None,
    ) -> None:
        with self._lock:
            run = self._owned_run(task, worker_id, now)
            run.last_heartbeat_at = now
            run.lease_expires_at = now + lease_duration
            if stage is not None:
                run.current_stage = stage
                run.updated_at = now

    def persist_stage(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        output: StageOutput,
        event: PublicEvent,
        now: datetime,
        lease_duration: timedelta,
    ) -> bool:
        with self._lock:
            run = self._owned_run(task, worker_id, now)
            output_key = (task.run_id, output.output_id)
            existing_output = self._outputs.get(output_key)
            existing_event = self._events.get(event.event_id)
            if existing_output is not None or existing_event is not None:
                if existing_output == output and existing_event == event:
                    return False
                raise RuntimeConflictError("deterministic stage write changed during replay")
            if event.sequence != run.last_sequence + 1:
                raise RuntimeConflictError("public event sequence must be contiguous")
            self._outputs[output_key] = output
            self._events[event.event_id] = event
            if output.stage not in run.completed_stages:
                run.completed_stages.append(output.stage)
            run.current_stage = output.stage
            run.last_sequence = event.sequence
            run.last_heartbeat_at = now
            run.lease_expires_at = now + lease_duration
            run.updated_at = now
            return True

    def record_provider_success(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        request_count: int,
        source_count: int,
        now: datetime,
    ) -> None:
        if request_count < 1 or source_count < 0:
            raise ValueError("provider counts must be non-negative with at least one request")
        with self._lock:
            run = self._owned_run(task, worker_id, now)
            # A provider proof is a per-version high-water mark, not an
            # invocation counter. Replaying after a crash cannot double-count.
            run.provider_request_count = max(run.provider_request_count, request_count)
            run.provider_source_count = max(run.provider_source_count, source_count)
            run.last_provider_success_at = now

    def next_event_sequence(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
    ) -> int:
        with self._lock:
            run = self._owned_run(task, worker_id, now)
            return run.last_sequence + 1

    def finish(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        status: RunStatus,
        event: PublicEvent,
        now: datetime,
    ) -> bool:
        if status not in {RunStatus.COMPLETE, RunStatus.PARTIAL, RunStatus.FAILED}:
            raise ValueError("finish requires a terminal run status")
        with self._lock:
            run = self._owned_run(task, worker_id, now)
            existing = self._events.get(event.event_id)
            if existing is not None:
                if existing == event and run.status == status:
                    return False
                raise RuntimeConflictError("deterministic terminal event changed during replay")
            if event.sequence != run.last_sequence + 1:
                raise RuntimeConflictError("public event sequence must be contiguous")
            completed_stages = list(run.completed_stages)
            if event.stage not in completed_stages and status is not RunStatus.FAILED:
                completed_stages.append(event.stage)
            missing = sorted(set(range(1, 7)) - set(completed_stages))
            if status is RunStatus.COMPLETE and missing:
                raise RuntimeConflictError("complete run is missing durable stage outputs")
            self._events[event.event_id] = event
            run.last_sequence = event.sequence
            run.status = status
            run.completed_stages = completed_stages
            run.missing_stages = missing
            run.current_stage = event.stage
            run.public_failure_message = (
                event.public_summary
                if status in {RunStatus.PARTIAL, RunStatus.FAILED}
                else None
            )
            run.retry_eligible = status is not RunStatus.COMPLETE
            run.last_heartbeat_at = now
            run.lease_owner = None
            run.lease_expires_at = None
            run.updated_at = now
            return True

    def release_for_retry(
        self, task: ResearchTaskRequest, worker_id: str, now: datetime
    ) -> None:
        with self._lock:
            run = self._owned_run(task, worker_id, now, allow_expired=True)
            run.status = RunStatus.QUEUED
            run.lease_owner = None
            run.lease_expires_at = now
            run.last_heartbeat_at = now
            run.retry_eligible = True
            run.updated_at = now

    def projection(self, run_id: str) -> PublicRunProjection:
        with self._lock:
            run = self._require_run(run_id)
            return PublicRunProjection(
                runId=run_id,
                projectId=run.project_id,
                attempt=run.attempt,
                researchVersion=run.research_version,
                status=run.status,
                currentStage=run.current_stage,
                completedStages=tuple(sorted(run.completed_stages)),
                missingStages=tuple(run.missing_stages),
                publicFailureMessage=run.public_failure_message,
                projectSlug=run.project_slug,
                cardUrl=run.card_url,
                retryEligible=run.retry_eligible,
                fallbackUsed=run.fallback_used,
                fallbackLabel=run.fallback_label,
                updatedAt=run.updated_at,
            )

    def provider_counts(self, run_id: str) -> tuple[int, int, datetime | None]:
        with self._lock:
            run = self._require_run(run_id)
            return (
                run.provider_request_count,
                run.provider_source_count,
                run.last_provider_success_at,
            )

    def events(self, run_id: str) -> list[PublicEvent]:
        with self._lock:
            events = [event for event in self._events.values() if event.run_id == run_id]
            return sorted(deepcopy(events), key=lambda event: event.sequence)

    def stage_output(self, run_id: str, output_id: str) -> StageOutput | None:
        with self._lock:
            return deepcopy(self._outputs.get((run_id, output_id)))

    def load_stage_output(
        self, task: ResearchTaskRequest, stage: int
    ) -> StageOutput | None:
        output_id = f"v{task.research_version:03d}_stage-{stage}"
        return self.stage_output(task.run_id, output_id)

    def _require_run(self, run_id: str) -> _RunState:
        try:
            return self._runs[run_id]
        except KeyError as error:
            raise KeyError(f"research run {run_id!r} does not exist") from error

    def _owned_run(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        *,
        allow_expired: bool = False,
    ) -> _RunState:
        run = self._require_run(task.run_id)
        if (
            run.lease_owner != worker_id
            or run.attempt != task.attempt
            or run.research_version != task.research_version
            or (not allow_expired and (run.lease_expires_at is None or run.lease_expires_at <= now))
        ):
            raise LeaseLostError("worker no longer owns the requested run lease")
        return run
