"""Firestore implementation of the durable runtime store.

The trusted service writes both internal run state and deliberately public
projections in the same transaction. Firestore security rules keep these
writes server-only.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, TypeVar, cast

from google.cloud import firestore

from audience_take_agents.runtime.models import (
    LeaseDisposition,
    LeaseResult,
    PublicEvent,
    PublicRunProjection,
    ResearchTaskRequest,
    RunStatus,
    StageOutput,
)
from audience_take_agents.runtime.store import LeaseLostError, RuntimeConflictError

T = TypeVar("T")


class FirestoreRuntimeStore:
    """Transactional adapter around an injected synchronous Firestore client."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def acquire_lease(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LeaseResult:
        run_ref = self._client.collection("researchRuns").document(task.run_id)
        projection_ref = self._client.collection("publicResearchRuns").document(task.run_id)

        def operation(transaction: Any) -> LeaseResult:
            snapshot = run_ref.get(transaction=transaction)
            public_data = self._public_data(transaction, projection_ref)
            if not snapshot.exists:
                raise KeyError(f"research run {task.run_id!r} does not exist")
            data = cast(dict[str, Any], snapshot.to_dict())
            status = RunStatus(data["status"])
            if data.get("projectId") != task.project_id:
                return LeaseResult(disposition=LeaseDisposition.SUPERSEDED)
            if status in {RunStatus.COMPLETE, RunStatus.PARTIAL, RunStatus.FAILED}:
                return LeaseResult(disposition=LeaseDisposition.COMPLETE)
            if (
                data.get("attemptCount") != task.attempt
                or data.get("researchVersion") != task.research_version
            ):
                return LeaseResult(disposition=LeaseDisposition.SUPERSEDED)

            current_owner = cast(str | None, data.get("leaseOwner"))
            current_expiry = cast(datetime | None, data.get("leaseExpiresAt"))
            healthy = current_expiry is not None and current_expiry > now
            if healthy and current_owner != worker_id:
                return LeaseResult(
                    disposition=LeaseDisposition.HEALTHY_OWNER,
                    lease_owner=current_owner,
                    lease_expires_at=current_expiry,
                )
            if healthy:
                disposition = LeaseDisposition.RENEWED
            elif current_owner is not None:
                disposition = LeaseDisposition.RECLAIMED
            else:
                disposition = LeaseDisposition.ACQUIRED

            expires_at = now + lease_duration
            transaction.update(
                run_ref,
                {
                    "status": RunStatus.RUNNING.value,
                    "leaseOwner": worker_id,
                    "leaseExpiresAt": expires_at,
                    "lastHeartbeatAt": now,
                    "startedAt": data.get("startedAt") or now,
                    "updatedAt": now,
                },
            )
            public_data["status"] = RunStatus.RUNNING.value
            transaction.set(
                projection_ref,
                self._projection_payload(task, data, public_data, now),
            )
            return LeaseResult(
                disposition=disposition,
                lease_owner=worker_id,
                lease_expires_at=expires_at,
            )

        return self._run_transaction(operation)

    def heartbeat(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
        stage: int | None = None,
    ) -> None:
        run_ref = self._client.collection("researchRuns").document(task.run_id)
        projection_ref = self._client.collection("publicResearchRuns").document(task.run_id)

        def operation(transaction: Any) -> None:
            data = self._owned_data(transaction, run_ref, task, worker_id, now)
            public_data = self._public_data(transaction, projection_ref)
            update: dict[str, Any] = {
                "lastHeartbeatAt": now,
                "leaseExpiresAt": now + lease_duration,
                "updatedAt": now,
            }
            if stage is not None:
                update["currentStage"] = stage
                data["currentStage"] = stage
            transaction.update(run_ref, update)
            if stage is not None:
                public_data["currentStage"] = stage
                public_data["status"] = RunStatus.RUNNING.value
                transaction.set(
                    projection_ref,
                    self._projection_payload(task, data, public_data, now),
                )

        self._run_transaction(operation)

    def persist_stage(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        output: StageOutput,
        event: PublicEvent,
        now: datetime,
        lease_duration: timedelta,
    ) -> bool:
        run_ref = self._client.collection("researchRuns").document(task.run_id)
        output_ref = run_ref.collection("stageOutputs").document(output.output_id)
        event_ref = self._client.collection("events").document(event.event_id)
        projection_ref = self._client.collection("publicResearchRuns").document(task.run_id)
        output_payload = {
            "runId": output.run_id,
            "researchVersion": output.research_version,
            "attempt": output.attempt,
            "stage": output.stage,
            "output": output.output,
            "completedAt": output.completed_at,
        }
        event_payload = event.model_dump(by_alias=True, mode="json", exclude_none=True)
        event_payload["sourceIds"] = list(event.source_ids)

        def operation(transaction: Any) -> bool:
            data = self._owned_data(transaction, run_ref, task, worker_id, now)
            output_snapshot = output_ref.get(transaction=transaction)
            event_snapshot = event_ref.get(transaction=transaction)
            public_data = self._public_data(transaction, projection_ref)
            if output_snapshot.exists or event_snapshot.exists:
                if (
                    output_snapshot.exists
                    and event_snapshot.exists
                    and output_snapshot.to_dict() == output_payload
                    and event_snapshot.to_dict() == event_payload
                ):
                    return False
                raise RuntimeConflictError("deterministic stage write changed during replay")
            last_sequence = int(data.get("lastEventSequence", 0))
            if event.sequence != last_sequence + 1:
                raise RuntimeConflictError("public event sequence must be contiguous")
            completed_stages = list(data.get("completedStages", []))
            if output.stage not in completed_stages:
                completed_stages.append(output.stage)
            transaction.create(output_ref, output_payload)
            transaction.create(event_ref, event_payload)
            transaction.update(
                run_ref,
                {
                    "currentStage": output.stage,
                    "completedStages": completed_stages,
                    "lastEventSequence": event.sequence,
                    "lastHeartbeatAt": now,
                    "leaseExpiresAt": now + lease_duration,
                    "updatedAt": now,
                },
            )
            data.update(
                {
                    "currentStage": output.stage,
                    "completedStages": completed_stages,
                    "lastEventSequence": event.sequence,
                }
            )
            public_data.update(
                {
                    "status": RunStatus.RUNNING.value,
                    "currentStage": output.stage,
                    "completedStages": completed_stages,
                }
            )
            transaction.set(
                projection_ref,
                self._projection_payload(task, data, public_data, now),
            )
            return True

        return self._run_transaction(operation)

    def load_stage_output(
        self, task: ResearchTaskRequest, stage: int
    ) -> StageOutput | None:
        output_id = f"v{task.research_version:03d}_stage-{stage}"
        snapshot = (
            self._client.collection("researchRuns")
            .document(task.run_id)
            .collection("stageOutputs")
            .document(output_id)
            .get()
        )
        if not snapshot.exists:
            return None
        data = cast(dict[str, Any], snapshot.to_dict())
        if (
            data.get("runId") != task.run_id
            or data.get("researchVersion") != task.research_version
        ):
            raise RuntimeConflictError("stored stage output belongs to another run version")
        return StageOutput(
            run_id=cast(str, data["runId"]),
            research_version=int(data["researchVersion"]),
            attempt=int(data["attempt"]),
            stage=int(data["stage"]),
            output=cast(dict[str, Any], data["output"]),
            completed_at=cast(datetime, data["completedAt"]),
        )

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
        run_ref = self._client.collection("researchRuns").document(task.run_id)
        event_ref = self._client.collection("events").document(event.event_id)
        projection_ref = self._client.collection("publicResearchRuns").document(task.run_id)
        event_payload = event.model_dump(by_alias=True, mode="json", exclude_none=True)
        event_payload["sourceIds"] = list(event.source_ids)

        def operation(transaction: Any) -> bool:
            data = self._owned_data(transaction, run_ref, task, worker_id, now)
            event_snapshot = event_ref.get(transaction=transaction)
            public_data = self._public_data(transaction, projection_ref)
            if event_snapshot.exists:
                if event_snapshot.to_dict() == event_payload and data.get("status") == status.value:
                    return False
                raise RuntimeConflictError("deterministic terminal event changed during replay")
            last_sequence = int(data.get("lastEventSequence", 0))
            if event.sequence != last_sequence + 1:
                raise RuntimeConflictError("public event sequence must be contiguous")
            completed_stages = list(data.get("completedStages", []))
            if status is not RunStatus.FAILED and event.stage not in completed_stages:
                completed_stages.append(event.stage)
            completed_stages = sorted({int(stage) for stage in completed_stages})
            missing_stages = sorted(set(range(1, 7)) - set(completed_stages))
            if status is RunStatus.COMPLETE and missing_stages:
                raise RuntimeConflictError("complete run is missing durable stage outputs")
            transaction.create(event_ref, event_payload)
            transaction.update(
                run_ref,
                {
                    "status": status.value,
                    "currentStage": event.stage,
                    "completedStages": completed_stages,
                    "missingStages": missing_stages,
                    "lastEventSequence": event.sequence,
                    "lastHeartbeatAt": now,
                    "leaseOwner": None,
                    "leaseExpiresAt": None,
                    "finishedAt": now,
                    "updatedAt": now,
                },
            )
            data.update(
                {
                    "lastEventSequence": event.sequence,
                    "currentStage": event.stage,
                    "completedStages": completed_stages,
                    "missingStages": missing_stages,
                }
            )
            public_data.update(
                {
                    "status": status.value,
                    "currentStage": event.stage,
                    "completedStages": completed_stages,
                    "missingStages": missing_stages,
                    "publicFailureMessage": (
                        event.public_summary
                        if status in {RunStatus.PARTIAL, RunStatus.FAILED}
                        else None
                    ),
                    "retryEligible": status is not RunStatus.COMPLETE,
                }
            )
            transaction.set(
                projection_ref,
                self._projection_payload(task, data, public_data, now),
            )
            return True

        return self._run_transaction(operation)

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
        run_ref = self._client.collection("researchRuns").document(task.run_id)

        def operation(transaction: Any) -> None:
            data = self._owned_data(transaction, run_ref, task, worker_id, now)
            transaction.update(
                run_ref,
                {
                    # High-water marks make a crash-before-stage-persist replay
                    # idempotent for this exact run version.
                    "parallelRequestCount": max(
                        int(data.get("parallelRequestCount", 0)), request_count
                    ),
                    "sourceCount": max(int(data.get("sourceCount", 0)), source_count),
                    "lastProviderSuccessAt": now,
                    "updatedAt": now,
                },
            )

        self._run_transaction(operation)

    def next_event_sequence(
        self,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
    ) -> int:
        run_ref = self._client.collection("researchRuns").document(task.run_id)

        def operation(transaction: Any) -> int:
            data = self._owned_data(transaction, run_ref, task, worker_id, now)
            return int(data.get("lastEventSequence", 0)) + 1

        return self._run_transaction(operation)

    def release_for_retry(
        self, task: ResearchTaskRequest, worker_id: str, now: datetime
    ) -> None:
        run_ref = self._client.collection("researchRuns").document(task.run_id)
        projection_ref = self._client.collection("publicResearchRuns").document(task.run_id)

        def operation(transaction: Any) -> None:
            data = self._owned_data(
                transaction, run_ref, task, worker_id, now, allow_expired=True
            )
            public_data = self._public_data(transaction, projection_ref)
            transaction.update(
                run_ref,
                {
                    "status": RunStatus.QUEUED.value,
                    "leaseOwner": None,
                    "leaseExpiresAt": now,
                    "lastHeartbeatAt": now,
                    "updatedAt": now,
                },
            )
            public_data.update(
                {
                    "status": RunStatus.QUEUED.value,
                    "retryEligible": True,
                }
            )
            transaction.set(
                projection_ref,
                self._projection_payload(task, data, public_data, now),
            )

        self._run_transaction(operation)

    def _run_transaction(self, operation: Callable[[Any], T]) -> T:
        @firestore.transactional
        def wrapped(transaction: Any) -> T:
            return operation(transaction)

        return cast(T, wrapped(self._client.transaction()))

    @staticmethod
    def _owned_data(
        transaction: Any,
        run_ref: Any,
        task: ResearchTaskRequest,
        worker_id: str,
        now: datetime,
        *,
        allow_expired: bool = False,
    ) -> dict[str, Any]:
        snapshot = run_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise KeyError(f"research run {task.run_id!r} does not exist")
        data = cast(dict[str, Any], snapshot.to_dict())
        expiry = cast(datetime | None, data.get("leaseExpiresAt"))
        if (
            data.get("leaseOwner") != worker_id
            or data.get("attemptCount") != task.attempt
            or data.get("researchVersion") != task.research_version
            or (not allow_expired and (expiry is None or expiry <= now))
        ):
            raise LeaseLostError("worker no longer owns the requested run lease")
        return data

    @staticmethod
    def _public_data(transaction: Any, projection_ref: Any) -> dict[str, Any]:
        snapshot = projection_ref.get(transaction=transaction)
        if not snapshot.exists:
            return {}
        return cast(dict[str, Any], snapshot.to_dict())

    @staticmethod
    def _projection_payload(
        task: ResearchTaskRequest,
        data: dict[str, Any],
        public_data: dict[str, Any],
        now: datetime,
    ) -> dict[str, Any]:
        projection = PublicRunProjection(
            runId=task.run_id,
            projectId=task.project_id,
            attempt=task.attempt,
            researchVersion=task.research_version,
            status=public_data.get("status", data.get("status", RunStatus.RUNNING.value)),
            currentStage=int(public_data.get("currentStage", data.get("currentStage", 1))),
            completedStages=tuple(
                int(stage)
                for stage in public_data.get(
                    "completedStages", data.get("completedStages", [])
                )
            ),
            missingStages=tuple(
                int(stage)
                for stage in public_data.get("missingStages", data.get("missingStages", []))
            ),
            publicFailureMessage=public_data.get("publicFailureMessage"),
            projectSlug=public_data.get("projectSlug"),
            cardUrl=public_data.get("cardUrl"),
            retryEligible=bool(public_data.get("retryEligible", False)),
            fallbackUsed=bool(
                public_data.get("fallbackUsed", data.get("fallbackUsed", False))
            ),
            fallbackLabel=public_data.get("fallbackLabel"),
            updatedAt=now,
        )
        payload = projection.model_dump(
            by_alias=True, mode="json", exclude={"fallback_label"}
        )
        if projection.fallback_label is not None:
            payload["fallbackLabel"] = projection.fallback_label
        return payload
