"""Runtime coordinator shared by the HTTP adapter and future ADK executor."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from audience_take_agents.runtime.models import (
    EventKind,
    LeaseResult,
    PublicEvent,
    ResearchTaskRequest,
    RunStatus,
    StageOutput,
    StageStatus,
    TaskDelivery,
)
from audience_take_agents.runtime.store import RuntimeStore


class ExecutorNotConfiguredError(RuntimeError):
    """Signals a retryable deployment configuration error."""


Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


class ResearchExecutor(Protocol):
    async def execute(self, context: RuntimeContext) -> None: ...


class MissingExecutor:
    async def execute(self, context: RuntimeContext) -> None:
        del context
        raise ExecutorNotConfiguredError("research executor is not configured")


class RuntimeContext:
    """Lease-scoped APIs available to the ADK orchestrator."""

    def __init__(
        self,
        *,
        task: ResearchTaskRequest,
        delivery: TaskDelivery,
        worker_id: str,
        store: RuntimeStore,
        clock: Clock,
        lease_duration: timedelta,
    ) -> None:
        self.task = task
        self.delivery = delivery
        self.worker_id = worker_id
        self._store = store
        self._clock = clock
        self._lease_duration = lease_duration

    def heartbeat(self, stage: int | None = None) -> None:
        self._store.heartbeat(
            self.task,
            self.worker_id,
            self._clock(),
            self._lease_duration,
            stage,
        )

    def load_stage_output(self, stage: int) -> StageOutput | None:
        """Load reusable output for this exact research version, if present."""
        return self._store.load_stage_output(self.task, stage)

    def persist_stage(
        self,
        *,
        sequence: int,
        stage: int,
        output: dict[str, Any],
        title: str,
        summary: str,
        kind: EventKind = EventKind.STAGE,
        tool_name: str | None = None,
        query_label: str | None = None,
        result_count: int | None = None,
        source_ids: tuple[str, ...] = (),
    ) -> bool:
        now = self._clock()
        stage_output = StageOutput(
            run_id=self.task.run_id,
            research_version=self.task.research_version,
            attempt=self.task.attempt,
            stage=stage,
            output=output,
            completed_at=now,
        )
        event = PublicEvent(
            runId=self.task.run_id,
            projectId=self.task.project_id,
            sequence=sequence,
            stage=stage,
            status=StageStatus.COMPLETE,
            kind=kind,
            publicTitle=title,
            publicSummary=summary,
            attempt=self.task.attempt,
            occurredAt=now,
            toolName=tool_name,
            queryLabel=query_label,
            resultCount=result_count,
            sourceIds=source_ids,
        )
        return self._store.persist_stage(
            self.task,
            self.worker_id,
            stage_output,
            event,
            now,
            self._lease_duration,
        )

    def record_provider_success(
        self, *, request_count: int = 1, source_count: int
    ) -> None:
        """Record only a completed provider request in the private run document."""
        self._store.record_provider_success(
            self.task,
            self.worker_id,
            request_count,
            source_count,
            self._clock(),
        )

    def next_event_sequence(self) -> int:
        """Return the next run-wide public receipt sequence under this lease."""
        return self._store.next_event_sequence(
            self.task,
            self.worker_id,
            self._clock(),
        )

    def finish(
        self,
        *,
        sequence: int,
        status: RunStatus,
        title: str,
        summary: str,
    ) -> bool:
        now = self._clock()
        event = PublicEvent(
            runId=self.task.run_id,
            projectId=self.task.project_id,
            sequence=sequence,
            stage=6,
            status=(
                StageStatus.COMPLETE
                if status is RunStatus.COMPLETE
                else StageStatus.INCOMPLETE
                if status is RunStatus.PARTIAL
                else StageStatus.FAILED
            ),
            kind=EventKind.PUBLICATION,
            publicTitle=title,
            publicSummary=summary,
            attempt=self.task.attempt,
            occurredAt=now,
        )
        return self._store.finish(self.task, self.worker_id, status, event, now)


class ResearchTaskRuntime:
    def __init__(
        self,
        *,
        store: RuntimeStore,
        executor: ResearchExecutor | None = None,
        clock: Clock = utc_now,
        lease_duration: timedelta = timedelta(minutes=5),
    ) -> None:
        self._store = store
        self._executor = executor or MissingExecutor()
        self._clock = clock
        self._lease_duration = lease_duration

    async def handle(
        self,
        task: ResearchTaskRequest,
        delivery: TaskDelivery,
        worker_id: str,
    ) -> LeaseResult:
        lease = self._store.acquire_lease(
            task, worker_id, self._clock(), self._lease_duration
        )
        if not lease.should_execute:
            return lease

        context = RuntimeContext(
            task=task,
            delivery=delivery,
            worker_id=worker_id,
            store=self._store,
            clock=self._clock,
            lease_duration=self._lease_duration,
        )
        try:
            await self._executor.execute(context)
        except Exception:
            self._store.release_for_retry(task, worker_id, self._clock())
            raise
        return lease
