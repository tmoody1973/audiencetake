from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from audience_take_agents.agents.provider import ModelOutputTruncatedError
from audience_take_agents.http_app import (
    _safe_error_chain,
    _safe_provider_failure_code,
    _safe_validation_errors,
    create_app,
)
from audience_take_agents.runtime.models import ResearchTaskRequest, RunStatus
from audience_take_agents.runtime.service import ResearchTaskRuntime, RuntimeContext
from audience_take_agents.runtime.store import InMemoryRuntimeStore

NOW = datetime(2026, 8, 26, 15, 0, tzinfo=UTC)
PAYLOAD = {
    "runId": "run_01",
    "projectId": "project_01",
    "attempt": 1,
    "researchVersion": 1,
    "taskName": "research-run_01-attempt-1",
}
HEADERS = {
    "Authorization": "Bearer cloud-run-validated-oidc",
    "X-CloudTasks-TaskName": (
        "projects/example/locations/us-central1/queues/research/tasks/"
        "research-run_01-attempt-1"
    ),
    "X-CloudTasks-QueueName": "projects/example/locations/us-central1/queues/research",
    "X-CloudTasks-TaskRetryCount": "0",
}


class HttpExecutor:
    async def execute(self, context: RuntimeContext) -> None:
        context.finish(
            sequence=1,
            status=RunStatus.PARTIAL,
            title="Partial Scout Card published",
            summary="Useful public evidence was preserved while later stages remain incomplete.",
        )


def make_client() -> TestClient:
    task = ResearchTaskRequest.model_validate(PAYLOAD)
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    runtime = ResearchTaskRuntime(store=store, executor=HttpExecutor(), clock=lambda: NOW)
    return TestClient(create_app(lambda: runtime))


TRAILER_PAYLOAD = {
    "projectId": "project_01",
    "sourceId": "source-video",
    "youtubeVideoId": "s8G7425lfKs",
    "youtubeUrl": "https://www.youtube.com/watch?v=s8G7425lfKs",
    "analysisVersion": 1,
    "taskName": "trailer-project_01-s8G7425lfKs-v1",
}
TRAILER_HEADERS = {
    **HEADERS,
    "X-CloudTasks-TaskName": (
        "projects/example/locations/us-central1/queues/research/tasks/"
        "trailer-project_01-s8G7425lfKs-v1"
    ),
}


class TrailerRuntime:
    def __init__(self) -> None:
        self.calls = 0

    async def handle(self, task: object, worker_id: str) -> tuple[str, str]:
        del task, worker_id
        self.calls += 1
        return "acquired", "video-analysis-abc-v1"


def test_health_check_is_public_and_non_secret() -> None:
    response = make_client().get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "audience-take-agents",
        "version": "0.1.0",
    }


def test_task_endpoint_rejects_unauthorized_request() -> None:
    response = make_client().post("/tasks/research", json=PAYLOAD)

    assert response.status_code == 401
    assert response.json()["detail"] == "OIDC bearer token required"


def test_task_endpoint_rejects_malformed_or_mismatched_task() -> None:
    malformed = make_client().post(
        "/tasks/research", json={**PAYLOAD, "attempt": 0}, headers=HEADERS
    )
    mismatched = make_client().post(
        "/tasks/research",
        json=PAYLOAD,
        headers={**HEADERS, "X-CloudTasks-TaskName": "tasks/some-other-task"},
    )

    assert malformed.status_code == 422
    assert mismatched.status_code == 400


def test_task_endpoint_runs_authorized_delivery() -> None:
    response = make_client().post("/tasks/research", json=PAYLOAD, headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "disposition": "acquired",
        "run_id": "run_01",
    }


def test_task_endpoint_acknowledges_retry_without_executor_call() -> None:
    def forbidden_runtime() -> ResearchTaskRuntime:
        raise AssertionError("retry must not construct the provider runtime")

    response = TestClient(create_app(forbidden_runtime)).post(
        "/tasks/research",
        json=PAYLOAD,
        headers={**HEADERS, "X-CloudTasks-TaskRetryCount": "1"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "disposition": "retry_suppressed",
        "run_id": "run_01",
    }


def test_trailer_endpoint_binds_deterministic_cloud_task_identity() -> None:
    trailer = TrailerRuntime()
    client = TestClient(create_app(lambda: make_client(), lambda: trailer))  # type: ignore[arg-type]

    response = client.post(
        "/tasks/trailer-critic", json=TRAILER_PAYLOAD, headers=TRAILER_HEADERS
    )
    mismatch = client.post(
        "/tasks/trailer-critic",
        json=TRAILER_PAYLOAD,
        headers={**TRAILER_HEADERS, "X-CloudTasks-TaskName": "tasks/wrong"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "disposition": "acquired",
        "artifact_id": "video-analysis-abc-v1",
    }
    assert trailer.calls == 1
    assert mismatch.status_code == 400


def test_trailer_endpoint_rejects_url_and_video_identity_mismatch() -> None:
    response = make_client().post(
        "/tasks/trailer-critic",
        json={**TRAILER_PAYLOAD, "youtubeUrl": "https://www.youtube.com/watch?v=aaaaaaaaaaa"},
        headers=TRAILER_HEADERS,
    )

    assert response.status_code == 422


def test_safe_error_chain_records_only_bounded_class_names() -> None:
    try:
        try:
            raise ValueError("sensitive provider response")
        except ValueError as error:
            raise RuntimeError("safe wrapper") from error
    except RuntimeError as error:
        assert _safe_error_chain(error) == ["RuntimeError", "ValueError"]


def test_safe_validation_errors_exclude_values_messages_and_context() -> None:
    try:
        try:
            ResearchTaskRequest.model_validate({**PAYLOAD, "attempt": 0})
        except ValueError as error:
            raise RuntimeError("wrapper containing private model output") from error
    except RuntimeError as error:
        safe_errors = _safe_validation_errors(error)

    assert safe_errors == [{"location": ["attempt"], "type": "greater_than_equal"}]
    assert "private" not in str(safe_errors)
    assert "0" not in str(safe_errors)


def test_safe_provider_failure_code_is_fixed_and_does_not_expose_messages() -> None:
    try:
        try:
            raise ModelOutputTruncatedError("sensitive provider output")
        except ModelOutputTruncatedError as error:
            raise RuntimeError("wrapper") from error
    except RuntimeError as error:
        code = _safe_provider_failure_code(error)

    assert code == "max_output_tokens"
    assert "sensitive" not in code
    assert _safe_provider_failure_code(ValueError("max_output_tokens")) is None
