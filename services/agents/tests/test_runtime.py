from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from audience_take_agents.runtime.models import (
    LeaseDisposition,
    PublicRunProjection,
    ResearchTaskRequest,
    RunStatus,
    TaskDelivery,
)
from audience_take_agents.runtime.service import ResearchTaskRuntime, RuntimeContext
from audience_take_agents.runtime.store import InMemoryRuntimeStore, RuntimeConflictError

NOW = datetime(2026, 8, 26, 15, 0, tzinfo=UTC)


def make_task(*, attempt: int = 1, version: int = 1) -> ResearchTaskRequest:
    return ResearchTaskRequest(
        runId="run_01",
        projectId="project_01",
        attempt=attempt,
        researchVersion=version,
        taskName=f"research-run_01-attempt-{attempt}",
    )


def make_delivery(task: ResearchTaskRequest) -> TaskDelivery:
    return TaskDelivery(
        full_task_name=f"projects/example/locations/us/queues/research/tasks/{task.task_name}",
        queue_name="projects/example/locations/us/queues/research",
        retry_count=0,
    )


class FixedClock:
    def __init__(self, value: datetime = NOW) -> None:
        self.value = value

    def __call__(self) -> datetime:
        return self.value


class CompletingExecutor:
    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, context: RuntimeContext) -> None:
        self.calls += 1
        for stage in range(1, 7):
            context.persist_stage(
                sequence=stage,
                stage=stage,
                output={"stage": stage},
                title=f"Stage {stage} complete",
                summary=f"Public stage {stage} completed with durable output.",
            )
        context.finish(
            sequence=7,
            status=RunStatus.COMPLETE,
            title="Scout Card published",
            summary="The sourced Scout Card is ready.",
        )


class FailingExecutor:
    async def execute(self, context: RuntimeContext) -> None:
        del context
        raise RuntimeError("transient provider failure")


def test_duplicate_delivery_does_not_repeat_stage_output() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    executor = CompletingExecutor()
    runtime = ResearchTaskRuntime(store=store, executor=executor, clock=FixedClock())

    first = asyncio.run(runtime.handle(task, make_delivery(task), "worker-a"))
    duplicate = asyncio.run(runtime.handle(task, make_delivery(task), "worker-b"))

    assert first.disposition is LeaseDisposition.ACQUIRED
    assert duplicate.disposition is LeaseDisposition.COMPLETE
    assert executor.calls == 1
    assert [event.sequence for event in store.events(task.run_id)] == list(range(1, 8))
    projection = store.projection(task.run_id)
    assert projection.status is RunStatus.COMPLETE
    assert projection.retry_eligible is False


def test_concurrent_duplicate_is_declined_while_lease_is_healthy() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)

    first = store.acquire_lease(task, "worker-a", NOW, timedelta(minutes=5))
    duplicate = store.acquire_lease(task, "worker-b", NOW, timedelta(minutes=5))

    assert first.disposition is LeaseDisposition.ACQUIRED
    assert duplicate.disposition is LeaseDisposition.HEALTHY_OWNER
    assert duplicate.lease_owner == "worker-a"


def test_expired_lease_is_reclaimed() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(
        task,
        status=RunStatus.RUNNING,
        lease_owner="dead-worker",
        lease_expires_at=NOW - timedelta(seconds=1),
    )
    executor = CompletingExecutor()
    runtime = ResearchTaskRuntime(store=store, executor=executor, clock=FixedClock())

    result = asyncio.run(runtime.handle(task, make_delivery(task), "replacement-worker"))

    assert result.disposition is LeaseDisposition.RECLAIMED
    assert executor.calls == 1


def test_retryable_failure_releases_lease_for_next_delivery() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    runtime = ResearchTaskRuntime(store=store, executor=FailingExecutor(), clock=FixedClock())

    with pytest.raises(RuntimeError, match="transient provider failure"):
        asyncio.run(runtime.handle(task, make_delivery(task), "failed-worker"))

    replacement = store.acquire_lease(task, "replacement", NOW, timedelta(minutes=5))
    assert replacement.disposition is LeaseDisposition.ACQUIRED


def test_completed_and_superseded_attempts_exit_successfully() -> None:
    current = make_task(attempt=2, version=2)
    stale = make_task(attempt=1, version=1)
    store = InMemoryRuntimeStore()
    store.seed_run(current)
    executor = CompletingExecutor()
    runtime = ResearchTaskRuntime(store=store, executor=executor, clock=FixedClock())

    stale_result = asyncio.run(runtime.handle(stale, make_delivery(stale), "worker-stale"))
    asyncio.run(runtime.handle(current, make_delivery(current), "worker-current"))
    completed_result = asyncio.run(
        runtime.handle(current, make_delivery(current), "worker-late")
    )

    assert stale_result.disposition is LeaseDisposition.SUPERSEDED
    assert completed_result.disposition is LeaseDisposition.COMPLETE
    assert executor.calls == 1


def test_stage_receipts_are_ordered_and_idempotent() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    clock = FixedClock()
    lease = timedelta(minutes=5)
    store.acquire_lease(task, "worker", NOW, lease)
    context = RuntimeContext(
        task=task,
        delivery=make_delivery(task),
        worker_id="worker",
        store=store,
        clock=clock,
        lease_duration=lease,
    )

    kwargs = {
        "sequence": 1,
        "stage": 1,
        "output": {"source": "submitted"},
        "title": "Source read",
        "summary": "The submitted public source was read.",
    }
    assert context.persist_stage(**kwargs) is True
    assert context.persist_stage(**kwargs) is False

    with pytest.raises(RuntimeConflictError, match="contiguous"):
        context.persist_stage(
            sequence=3,
            stage=2,
            output={"claims": []},
            title="Story mapped",
            summary="Public story and creator context was mapped.",
        )

    assert [event.sequence for event in store.events(task.run_id)] == [1]
    assert store.stage_output(task.run_id, "v001_stage-1") is not None
    reusable = context.load_stage_output(1)
    assert reusable is not None
    assert reusable.output == {"source": "submitted"}


def test_terminal_receipt_advances_after_a_prior_failed_publication() -> None:
    task = make_task(attempt=15)
    store = InMemoryRuntimeStore()
    store.seed_run(
        task,
        completed_stages=(1, 2, 3, 4, 5),
        current_stage=6,
        last_sequence=6,
    )
    store.acquire_lease(task, "worker", NOW, timedelta(minutes=5))
    context = RuntimeContext(
        task=task,
        delivery=make_delivery(task),
        worker_id="worker",
        store=store,
        clock=FixedClock(),
        lease_duration=timedelta(minutes=5),
    )

    context.finish(
        sequence=context.next_event_sequence(),
        status=RunStatus.COMPLETE,
        title="Scout Card published",
        summary="The sourced Scout Card is ready.",
    )

    assert [event.sequence for event in store.events(task.run_id)] == [7]
    projection = store.projection(task.run_id)
    assert projection.status is RunStatus.COMPLETE
    assert projection.completed_stages == (1, 2, 3, 4, 5, 6)


def test_heartbeat_renews_lease_and_projects_current_stage() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    clock = FixedClock()
    first = store.acquire_lease(task, "worker", NOW, timedelta(minutes=5))
    assert first.lease_expires_at == NOW + timedelta(minutes=5)

    clock.value = NOW + timedelta(minutes=2)
    context = RuntimeContext(
        task=task,
        delivery=make_delivery(task),
        worker_id="worker",
        store=store,
        clock=clock,
        lease_duration=timedelta(minutes=5),
    )
    context.heartbeat(3)
    renewed = store.acquire_lease(
        task, "worker", clock.value, timedelta(minutes=5)
    )

    assert renewed.disposition is LeaseDisposition.RENEWED
    assert renewed.lease_expires_at == clock.value + timedelta(minutes=5)
    projection = store.projection(task.run_id)
    assert projection.current_stage == 3
    assert projection.updated_at == clock.value


def test_provider_success_counts_remain_private() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    store.acquire_lease(task, "worker", NOW, timedelta(minutes=5))
    context = RuntimeContext(
        task=task,
        delivery=make_delivery(task),
        worker_id="worker",
        store=store,
        clock=FixedClock(),
        lease_duration=timedelta(minutes=5),
    )

    context.record_provider_success(source_count=4)
    context.record_provider_success(source_count=4)
    context.record_provider_success(request_count=2, source_count=0)

    assert store.provider_counts(task.run_id) == (2, 4, NOW)
    projection_fields = set(PublicRunProjection.model_fields)
    assert "provider_request_count" not in projection_fields
    assert "last_heartbeat_at" not in projection_fields
    assert "lease_owner" not in projection_fields


def test_public_projection_and_events_match_frozen_safe_contracts() -> None:
    task = make_task()
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    runtime = ResearchTaskRuntime(store=store, executor=CompletingExecutor(), clock=FixedClock())
    asyncio.run(runtime.handle(task, make_delivery(task), "worker"))

    root = Path(__file__).resolve().parents[3]
    projection_schema = json.loads(
        (root / "contracts/schemas/public-run-projection.schema.json").read_text()
    )
    event_schema = json.loads(
        (root / "contracts/schemas/research-event.schema.json").read_text()
    )
    projection = store.projection(task.run_id).model_dump(
        by_alias=True, mode="json", exclude={"fallback_label"}
    )
    Draft202012Validator(
        projection_schema, format_checker=FormatChecker()
    ).validate(projection)
    for event in store.events(task.run_id):
        payload = event.model_dump(by_alias=True, mode="json", exclude_none=True)
        Draft202012Validator(event_schema, format_checker=FormatChecker()).validate(payload)
        assert payload["publicVisibility"] == "public"
        assert isinstance(payload["stage"], int)
