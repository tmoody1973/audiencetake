"""Publication persistence protocol and transactional in-memory reference store."""

from __future__ import annotations

from collections.abc import Sequence
from copy import deepcopy
from dataclasses import dataclass
from threading import RLock
from typing import Any, Literal, Protocol

from audience_take_agents.publication.errors import (
    ImmutableVersionError,
    PublicationConflictError,
    PublicationWriteError,
    SemanticContractError,
)
from audience_take_agents.publication.schema import validate_schema

FailureStage = Literal["sources", "pathways", "card", "publication", "pointer"]


@dataclass(frozen=True)
class ProjectPublicationPointer:
    project_id: str
    run_id: str
    research_version: int
    card_version_id: str
    publication_id: str
    completeness: Literal["complete", "partial"]


@dataclass(frozen=True)
class RetryReservation:
    idempotency_key: str
    project_id: str
    run_id: str
    research_version: int
    attempt: int


class PublicationStore(Protocol):
    def commit(
        self,
        decision: dict[str, Any],
        *,
        sources: Sequence[dict[str, Any]],
        pathways: Sequence[dict[str, Any]],
        card: dict[str, Any] | None,
        failure_at: FailureStage | None = None,
    ) -> bool: ...

    def reserve_retry(
        self,
        *,
        idempotency_key: str,
        project_id: str,
        run_id: str,
        expected_previous_version: int | None,
        attempt: int,
    ) -> RetryReservation: ...


class InMemoryPublicationStore:
    """Atomic fake that preserves every prior artifact version and retry key."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._sources: dict[tuple[str, int, str], dict[str, Any]] = {}
        self._pathways: dict[tuple[str, int, str], dict[str, Any]] = {}
        self._cards: dict[str, dict[str, Any]] = {}
        self._publications: dict[str, dict[str, Any]] = {}
        self._pointers: dict[str, ProjectPublicationPointer] = {}
        self._retry_reservations: dict[str, RetryReservation] = {}
        self._active_retry_by_version: dict[tuple[str, int], str] = {}

    def commit(
        self,
        decision: dict[str, Any],
        *,
        sources: Sequence[dict[str, Any]],
        pathways: Sequence[dict[str, Any]],
        card: dict[str, Any] | None,
        failure_at: FailureStage | None = None,
    ) -> bool:
        validate_schema("card-publication.schema.json", decision)
        with self._lock:
            publication_id = str(decision["publicationId"])
            existing = self._publications.get(publication_id)
            if existing is not None:
                if existing == decision and self._is_exact_replay(
                    decision, sources=sources, pathways=pathways, card=card
                ):
                    return False
                raise PublicationConflictError(
                    "publication idempotency key was replayed with different content"
                )

            outcome = str(decision["outcome"])
            if outcome == "failed":
                if sources or pathways or card is not None:
                    raise SemanticContractError("failed publication cannot persist card artifacts")
            else:
                self._validate_success_artifacts(decision, sources, pathways, card)
                pointer = self._pointers.get(str(decision["projectId"]))
                if (
                    pointer is not None
                    and int(decision["researchVersion"]) <= pointer.research_version
                ):
                    raise ImmutableVersionError("a published research version cannot be replaced")

            next_sources = deepcopy(self._sources)
            next_pathways = deepcopy(self._pathways)
            next_cards = deepcopy(self._cards)
            next_publications = deepcopy(self._publications)
            next_pointers = deepcopy(self._pointers)

            for source in sources:
                key = (
                    str(decision["projectId"]),
                    int(decision["researchVersion"]),
                    str(source["id"]),
                )
                self._write_immutable(next_sources, key, source, "source")
            self._inject(failure_at, "sources")

            for pathway in pathways:
                key = (
                    str(decision["projectId"]),
                    int(decision["researchVersion"]),
                    str(pathway["id"]),
                )
                self._write_immutable(next_pathways, key, pathway, "pathway")
            self._inject(failure_at, "pathways")

            if card is not None:
                self._write_immutable(next_cards, str(card["cardVersionId"]), card, "card")
            self._inject(failure_at, "card")

            next_publications[publication_id] = deepcopy(decision)
            self._inject(failure_at, "publication")

            if card is not None:
                next_pointers[str(decision["projectId"])] = ProjectPublicationPointer(
                    project_id=str(decision["projectId"]),
                    run_id=str(decision["runId"]),
                    research_version=int(decision["researchVersion"]),
                    card_version_id=str(card["cardVersionId"]),
                    publication_id=publication_id,
                    completeness=card["completeness"],
                )
            self._inject(failure_at, "pointer")

            self._sources = next_sources
            self._pathways = next_pathways
            self._cards = next_cards
            self._publications = next_publications
            self._pointers = next_pointers
            return True

    def reserve_retry(
        self,
        *,
        idempotency_key: str,
        project_id: str,
        run_id: str,
        expected_previous_version: int | None,
        attempt: int,
    ) -> RetryReservation:
        if not idempotency_key or not run_id or attempt < 1:
            raise ValueError(
                "retry reservation fields must be non-empty and attempt must be positive"
            )
        with self._lock:
            existing = self._retry_reservations.get(idempotency_key)
            if existing is not None:
                expected = RetryReservation(
                    idempotency_key=idempotency_key,
                    project_id=project_id,
                    run_id=run_id,
                    research_version=existing.research_version,
                    attempt=attempt,
                )
                if existing != expected:
                    raise PublicationConflictError(
                        "retry idempotency key was replayed with different content"
                    )
                return existing

            pointer = self._pointers.get(project_id)
            current_version = pointer.research_version if pointer is not None else None
            if current_version != expected_previous_version:
                raise PublicationConflictError("project pointer changed before retry reservation")
            next_version = (current_version or 0) + 1
            active_key = self._active_retry_by_version.get((project_id, next_version))
            if active_key is not None:
                raise PublicationConflictError(
                    "another idempotency key already reserved the next research version"
                )
            reservation = RetryReservation(
                idempotency_key=idempotency_key,
                project_id=project_id,
                run_id=run_id,
                research_version=next_version,
                attempt=attempt,
            )
            self._retry_reservations[idempotency_key] = reservation
            self._active_retry_by_version[(project_id, next_version)] = idempotency_key
            return reservation

    def pointer(self, project_id: str) -> ProjectPublicationPointer | None:
        with self._lock:
            return deepcopy(self._pointers.get(project_id))

    def card(self, card_version_id: str) -> dict[str, Any] | None:
        with self._lock:
            return deepcopy(self._cards.get(card_version_id))

    def publication(self, publication_id: str) -> dict[str, Any] | None:
        with self._lock:
            return deepcopy(self._publications.get(publication_id))

    def source(
        self, project_id: str, research_version: int, source_id: str
    ) -> dict[str, Any] | None:
        with self._lock:
            return deepcopy(self._sources.get((project_id, research_version, source_id)))

    def pathway(
        self, project_id: str, research_version: int, pathway_id: str
    ) -> dict[str, Any] | None:
        with self._lock:
            return deepcopy(self._pathways.get((project_id, research_version, pathway_id)))

    @staticmethod
    def _write_immutable(
        target: dict[Any, dict[str, Any]], key: Any, value: dict[str, Any], label: str
    ) -> None:
        existing = target.get(key)
        if existing is not None and existing != value:
            raise ImmutableVersionError(f"immutable {label} version cannot be overwritten")
        target[key] = deepcopy(value)

    def _is_exact_replay(
        self,
        decision: dict[str, Any],
        *,
        sources: Sequence[dict[str, Any]],
        pathways: Sequence[dict[str, Any]],
        card: dict[str, Any] | None,
    ) -> bool:
        project_id = str(decision["projectId"])
        version = int(decision["researchVersion"])
        stored_sources = [
            self._sources.get((project_id, version, str(source["id"]))) for source in sources
        ]
        stored_pathways = [
            self._pathways.get((project_id, version, str(pathway["id"]))) for pathway in pathways
        ]
        stored_card = None if card is None else self._cards.get(str(card["cardVersionId"]))
        return (
            stored_sources == list(sources)
            and stored_pathways == list(pathways)
            and stored_card == card
            and len(sources) == len(decision["sourceIds"])
            and len(pathways) == len(decision["pathwayIds"])
        )

    @staticmethod
    def _inject(requested: FailureStage | None, current: FailureStage) -> None:
        if requested == current:
            raise PublicationWriteError(f"injected publication failure at {current}")

    @staticmethod
    def _validate_success_artifacts(
        decision: dict[str, Any],
        sources: Sequence[dict[str, Any]],
        pathways: Sequence[dict[str, Any]],
        card: dict[str, Any] | None,
    ) -> None:
        if card is None:
            raise SemanticContractError("complete and partial publications require a card")
        validate_schema("scout-card.schema.json", card)
        if str(card["cardVersionId"]) != decision["cardVersionId"]:
            raise SemanticContractError("publication and card version IDs differ")
        if card["completeness"] != decision["outcome"]:
            raise SemanticContractError("publication outcome and card completeness differ")
        if {str(source["id"]) for source in sources} != set(decision["sourceIds"]):
            raise SemanticContractError("publication source IDs differ from versioned sources")
        if {str(pathway["id"]) for pathway in pathways} != set(decision["pathwayIds"]):
            raise SemanticContractError("publication pathway IDs differ from versioned pathways")
        for source in sources:
            validate_schema("source.schema.json", source)
            if source["projectId"] != decision["projectId"] or source["runId"] != decision["runId"]:
                raise SemanticContractError("source identity differs from publication")
        for pathway in pathways:
            validate_schema("pathway.schema.json", pathway)
            if (
                pathway["projectId"] != decision["projectId"]
                or pathway["runId"] != decision["runId"]
            ):
                raise SemanticContractError("pathway identity differs from publication")
