"""Atomic Firestore adapter for the publication-layer store protocol."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, TypeVar, cast

from google.cloud import firestore

from audience_take_agents.publication.errors import (
    ImmutableVersionError,
    PublicationConflictError,
    PublicationWriteError,
)
from audience_take_agents.publication.store import FailureStage, RetryReservation

T = TypeVar("T")


class FirestorePublicationStore:
    """Commit immutable card artifacts and the project pointer in one transaction."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def commit(
        self,
        decision: dict[str, Any],
        *,
        sources: Sequence[dict[str, Any]],
        pathways: Sequence[dict[str, Any]],
        card: dict[str, Any] | None,
        failure_at: FailureStage | None = None,
    ) -> bool:
        if failure_at is not None:
            raise PublicationWriteError("failure injection is available only in test stores")
        publication_id = str(decision["publicationId"])
        publication_ref = self._client.collection("cardPublications").document(publication_id)
        project_ref = self._client.collection("projects").document(str(decision["projectId"]))

        def operation(transaction: Any) -> bool:
            existing = publication_ref.get(transaction=transaction)
            if existing.exists:
                if existing.to_dict() == decision:
                    return False
                raise PublicationConflictError(
                    "publication idempotency key was replayed with different content"
                )
            project_snapshot = project_ref.get(transaction=transaction)
            if not project_snapshot.exists:
                raise PublicationConflictError("publication project does not exist")
            project = cast(dict[str, Any], project_snapshot.to_dict())
            version = int(decision["researchVersion"])
            published_version = project.get("publishedResearchVersion")
            if published_version is not None and version <= int(published_version):
                raise ImmutableVersionError("a published research version cannot be replaced")

            for source in sources:
                source_ref = self._versioned_ref("sources", decision, source)
                transaction.create(
                    source_ref,
                    {
                        **source,
                        "researchVersion": version,
                        "visibility": "public",
                    },
                )
            for pathway in pathways:
                pathway_ref = self._versioned_ref("pathways", decision, pathway)
                transaction.create(
                    pathway_ref,
                    {
                        **pathway,
                        "researchVersion": version,
                        "visibility": "public",
                    },
                )
            if card is not None:
                card_ref = self._client.collection("scoutCards").document(
                    str(card["cardVersionId"])
                )
                transaction.create(card_ref, {**card, "visibility": "public"})
            transaction.create(publication_ref, decision)

            outcome = str(decision["outcome"])
            project_update: dict[str, Any] = {
                "latestRunId": decision["runId"],
                "researchVersion": version,
                "missingSections": list(decision["missingSections"]),
                "lastResearchedAt": decision["publishedAt"],
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
            if outcome in {"complete", "partial"}:
                project_update.update(
                    {
                        "publishedResearchVersion": version,
                        "latestCardVersionId": decision["cardVersionId"],
                        "publicationStatus": "published",
                        "cardCompleteness": outcome,
                    }
                )
            else:
                project_update.update(
                    {
                        "publicationStatus": "failed",
                        "cardCompleteness": "failed",
                    }
                )
            transaction.update(project_ref, project_update)
            return True

        return self._run_transaction(operation)

    def reserve_retry(
        self,
        *,
        idempotency_key: str,
        project_id: str,
        run_id: str,
        expected_previous_version: int | None,
        attempt: int,
    ) -> RetryReservation:
        reservation_ref = self._client.collection("researchRetryReservations").document(
            idempotency_key
        )
        project_ref = self._client.collection("projects").document(project_id)

        def operation(transaction: Any) -> RetryReservation:
            existing = reservation_ref.get(transaction=transaction)
            if existing.exists:
                data = cast(dict[str, Any], existing.to_dict())
                reservation = RetryReservation(**data)
                if (
                    reservation.project_id != project_id
                    or reservation.run_id != run_id
                    or reservation.attempt != attempt
                ):
                    raise PublicationConflictError(
                        "retry idempotency key was replayed with different content"
                    )
                return reservation
            project_snapshot = project_ref.get(transaction=transaction)
            if not project_snapshot.exists:
                raise PublicationConflictError("retry project does not exist")
            project = cast(dict[str, Any], project_snapshot.to_dict())
            current_raw = project.get("publishedResearchVersion")
            current = int(current_raw) if current_raw is not None else None
            if current != expected_previous_version:
                raise PublicationConflictError("project pointer changed before retry reservation")
            reservation = RetryReservation(
                idempotency_key=idempotency_key,
                project_id=project_id,
                run_id=run_id,
                research_version=(current or 0) + 1,
                attempt=attempt,
            )
            transaction.create(reservation_ref, reservation.__dict__)
            return reservation

        return self._run_transaction(operation)

    def _versioned_ref(
        self,
        collection: str,
        decision: dict[str, Any],
        artifact: dict[str, Any],
    ) -> Any:
        document_id = (
            f"{decision['projectId']}_v{decision['researchVersion']}_{artifact['id']}"
        )
        return self._client.collection(collection).document(document_id)

    def _run_transaction(self, operation: Callable[[Any], T]) -> T:
        @firestore.transactional
        def wrapped(transaction: Any) -> T:
            return operation(transaction)

        return cast(T, wrapped(self._client.transaction()))

