"""Private Cloud Run HTTP adapter for durable research tasks."""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, status
from google.cloud import firestore
from pydantic import BaseModel, ConfigDict, ValidationError

from audience_take_agents.app import create_research_executor, service_identity
from audience_take_agents.runtime.firestore_store import FirestoreRuntimeStore
from audience_take_agents.runtime.models import ResearchTaskRequest, TaskDelivery
from audience_take_agents.runtime.service import ExecutorNotConfiguredError, ResearchTaskRuntime

RuntimeFactory = Callable[[], ResearchTaskRuntime]


def _safe_error_chain(error: BaseException) -> list[str]:
    """Return bounded exception class names without logging messages or payloads."""
    result: list[str] = []
    current: BaseException | None = error
    while current is not None and len(result) < 6:
        result.append(type(current).__name__)
        current = current.__cause__ or current.__context__
    return result


def _safe_validation_errors(error: BaseException) -> list[dict[str, object]]:
    """Return bounded Pydantic locations/types without values or messages."""
    current: BaseException | None = error
    seen: set[int] = set()
    while current is not None and len(seen) < 8:
        if id(current) in seen:
            break
        seen.add(id(current))
        if isinstance(current, ValidationError):
            return [
                {
                    "location": [
                        part if isinstance(part, (str, int)) else type(part).__name__
                        for part in item["loc"]
                    ],
                    "type": str(item["type"]),
                }
                for item in current.errors(
                    include_url=False,
                    include_context=False,
                    include_input=False,
                )[:12]
            ]
        current = current.__cause__ or current.__context__
    return []


def _safe_provider_failure_code(error: BaseException) -> str | None:
    """Return only a fixed application-owned provider reason code."""
    allowed = {
        "model_output_error",
        "max_output_tokens",
        "provider_finish_error",
        "invalid_json",
    }
    current: BaseException | None = error
    seen: set[int] = set()
    while current is not None and len(seen) < 8:
        if id(current) in seen:
            break
        seen.add(id(current))
        code = getattr(current, "safe_code", None)
        if isinstance(code, str) and code in allowed:
            return code
        current = current.__cause__ or current.__context__
    return None


def _log_safe_task_failure(payload: ResearchTaskRequest, error: BaseException) -> None:
    safe_payload: dict[str, object] = {
        "severity": "ERROR",
        "message": "research task failed safely",
        "runId": payload.run_id,
        "attempt": payload.attempt,
        "errorChain": _safe_error_chain(error),
    }
    if validation_errors := _safe_validation_errors(error):
        safe_payload["validationErrors"] = validation_errors
    if provider_failure_code := _safe_provider_failure_code(error):
        safe_payload["providerFailureCode"] = provider_failure_code
    print(json.dumps(safe_payload), flush=True)


def _max_task_retry_count() -> int:
    try:
        return max(0, int(os.environ.get("AUDIENCE_TAKE_MAX_TASK_RETRY_COUNT", "0")))
    except ValueError:
        return 0


class TaskResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ok: bool = True
    disposition: str
    run_id: str


def _default_runtime() -> ResearchTaskRuntime:
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    client = firestore.Client(project=project)
    return ResearchTaskRuntime(
        store=FirestoreRuntimeStore(client),
        executor=create_research_executor(client),
    )


def create_app(runtime_factory: RuntimeFactory = _default_runtime) -> FastAPI:
    app = FastAPI(
        title="Audience Take research runtime",
        version=service_identity().version,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        identity = service_identity()
        return {"status": "ok", "service": identity.name, "version": identity.version}

    @app.post("/tasks/research", response_model=TaskResponse)
    async def research_task(
        payload: ResearchTaskRequest,
        authorization: Annotated[str | None, Header()] = None,
        cloud_task_name: Annotated[str | None, Header(alias="X-CloudTasks-TaskName")] = None,
        cloud_queue_name: Annotated[str | None, Header(alias="X-CloudTasks-QueueName")] = None,
        retry_count_header: Annotated[
            str | None, Header(alias="X-CloudTasks-TaskRetryCount")
        ] = None,
    ) -> TaskResponse:
        # Cloud Run IAM validates the OIDC token and configured audience before
        # this code runs. These checks reject accidental/direct invocation and
        # bind the trusted transport metadata to the payload.
        if authorization is None or not authorization.startswith("Bearer "):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "OIDC bearer token required")
        if not authorization.removeprefix("Bearer ").strip():
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "OIDC bearer token required")
        if cloud_task_name is None or cloud_queue_name is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cloud Tasks headers required")
        if cloud_task_name.rsplit("/", maxsplit=1)[-1] != payload.task_name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "task name does not match payload")
        try:
            retry_count = int(retry_count_header or "0")
        except ValueError as error:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid retry count") from error
        if retry_count < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid retry count")
        if retry_count > _max_task_retry_count():
            return TaskResponse(
                disposition="retry_suppressed",
                run_id=payload.run_id,
            )

        delivery = TaskDelivery(
            full_task_name=cloud_task_name,
            queue_name=cloud_queue_name,
            retry_count=retry_count,
        )
        worker_id = f"cloud-run-{uuid4().hex}"
        runtime = runtime_factory()
        try:
            lease = await runtime.handle(payload, delivery, worker_id)
        except ExecutorNotConfiguredError as error:
            _log_safe_task_failure(payload, error)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "research executor unavailable"
            ) from error
        except Exception as error:
            _log_safe_task_failure(payload, error)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "research task failed safely"
            ) from error
        return TaskResponse(
            disposition=lease.disposition.value,
            run_id=payload.run_id,
        )

    return app


app = create_app()
