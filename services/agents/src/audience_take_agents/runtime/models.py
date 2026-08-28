"""Public-safe task, lease, and receipt models."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    PARTIAL = "partial"
    FAILED = "failed"


class StageStatus(StrEnum):
    WAITING = "waiting"
    ACTIVE = "active"
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    FAILED = "failed"


class EventKind(StrEnum):
    STAGE = "stage"
    TOOL_RECEIPT = "tool_receipt"
    SOURCE_RECEIPT = "source_receipt"
    WARNING = "warning"
    PUBLICATION = "publication"


class LeaseDisposition(StrEnum):
    ACQUIRED = "acquired"
    RENEWED = "renewed"
    RECLAIMED = "reclaimed"
    HEALTHY_OWNER = "healthy_owner"
    COMPLETE = "complete"
    SUPERSEDED = "superseded"


class ResearchTaskRequest(BaseModel):
    """Trusted payload placed on the Cloud Tasks queue by the web backend."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    run_id: str = Field(alias="runId", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    project_id: str = Field(
        alias="projectId", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$"
    )
    attempt: int = Field(ge=1, le=100)
    research_version: int = Field(alias="researchVersion", ge=1)
    task_name: str = Field(
        alias="taskName", min_length=1, max_length=500, pattern=r"^[A-Za-z0-9_-]+$"
    )

    @field_validator("task_name")
    @classmethod
    def task_name_matches_attempt(cls, value: str, info: Any) -> str:
        run_id = info.data.get("run_id")
        attempt = info.data.get("attempt")
        if run_id is not None and attempt is not None:
            expected = deterministic_task_id(str(run_id), int(attempt))
            if value != expected:
                raise ValueError(f"taskName must equal {expected}")
        return value


def deterministic_task_id(run_id: str, attempt: int) -> str:
    """Return the queue task ID shared by the producer and handler."""
    return f"research-{run_id}-attempt-{attempt}"


class TrailerCriticTaskRequest(BaseModel):
    """Trusted payload for one independently idempotent video-analysis job."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    project_id: str = Field(
        alias="projectId", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$"
    )
    source_id: str = Field(
        alias="sourceId", min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_-]+$"
    )
    youtube_video_id: str = Field(alias="youtubeVideoId", pattern=r"^[A-Za-z0-9_-]{11}$")
    youtube_url: str = Field(
        alias="youtubeUrl",
        max_length=80,
        pattern=r"^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$",
    )
    analysis_version: int = Field(alias="analysisVersion", ge=1, le=100)
    task_name: str = Field(
        alias="taskName", min_length=1, max_length=500, pattern=r"^[A-Za-z0-9_-]+$"
    )

    @model_validator(mode="after")
    def identity_is_deterministic(self) -> TrailerCriticTaskRequest:
        expected_url = f"https://www.youtube.com/watch?v={self.youtube_video_id}"
        if self.youtube_url != expected_url:
            raise ValueError("youtubeUrl must match youtubeVideoId")
        expected_task = deterministic_trailer_task_id(
            self.project_id, self.youtube_video_id, self.analysis_version
        )
        if self.task_name != expected_task:
            raise ValueError(f"taskName must equal {expected_task}")
        return self


def deterministic_trailer_task_id(
    project_id: str, youtube_video_id: str, analysis_version: int
) -> str:
    return f"trailer-{project_id}-{youtube_video_id}-v{analysis_version}"


class TaskDelivery(BaseModel):
    """Cloud Tasks transport metadata that is safe to log."""

    model_config = ConfigDict(frozen=True)

    full_task_name: str
    queue_name: str
    retry_count: int = Field(ge=0)


class LeaseResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    disposition: LeaseDisposition
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None

    @property
    def should_execute(self) -> bool:
        return self.disposition in {
            LeaseDisposition.ACQUIRED,
            LeaseDisposition.RENEWED,
            LeaseDisposition.RECLAIMED,
        }


class PublicEvent(BaseModel):
    """A deliberately public receipt; hidden prompts and reasoning have no field."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    run_id: str = Field(alias="runId")
    project_id: str = Field(alias="projectId")
    sequence: int = Field(ge=1)
    stage: int = Field(ge=1, le=6)
    status: StageStatus
    kind: EventKind
    public_title: str = Field(alias="publicTitle", min_length=1, max_length=120)
    public_summary: str = Field(alias="publicSummary", min_length=1, max_length=500)
    public_visibility: Literal["public"] = Field(default="public", alias="publicVisibility")
    attempt: int = Field(ge=1)
    occurred_at: datetime = Field(alias="occurredAt")
    tool_name: str | None = Field(default=None, alias="toolName", min_length=1, max_length=120)
    query_label: str | None = Field(default=None, alias="queryLabel", min_length=1, max_length=160)
    result_count: int | None = Field(default=None, alias="resultCount", ge=0)
    source_ids: tuple[str, ...] = Field(default=(), alias="sourceIds")

    @field_validator("source_ids")
    @classmethod
    def source_ids_are_unique(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if len(value) != len(set(value)):
            raise ValueError("sourceIds must be unique")
        if any(not source_id for source_id in value):
            raise ValueError("sourceIds cannot contain empty values")
        return value

    @property
    def event_id(self) -> str:
        return f"{self.run_id}_{self.attempt:03d}_{self.sequence:04d}"


class StageOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    run_id: str
    research_version: int
    attempt: int
    stage: int = Field(ge=1, le=6)
    output: dict[str, Any]
    completed_at: datetime

    @property
    def output_id(self) -> str:
        return f"v{self.research_version:03d}_stage-{self.stage}"


class PublicRunProjection(BaseModel):
    """Exact safe document consumed by the public research progress screen."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    run_id: str = Field(alias="runId", min_length=1)
    project_id: str = Field(alias="projectId", min_length=1)
    attempt: int = Field(ge=1)
    research_version: int = Field(alias="researchVersion", ge=1)
    status: RunStatus
    current_stage: int = Field(alias="currentStage", ge=1, le=6)
    completed_stages: tuple[int, ...] = Field(alias="completedStages")
    missing_stages: tuple[int, ...] = Field(alias="missingStages")
    public_failure_message: str | None = Field(alias="publicFailureMessage", max_length=500)
    project_slug: str | None = Field(alias="projectSlug", pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    card_url: str | None = Field(alias="cardUrl", pattern=r"^/projects/[a-z0-9]+(?:-[a-z0-9]+)*$")
    retry_eligible: bool = Field(alias="retryEligible")
    fallback_used: bool = Field(alias="fallbackUsed")
    fallback_label: str | None = Field(default=None, alias="fallbackLabel")
    updated_at: datetime = Field(alias="updatedAt")

    @field_validator("completed_stages", "missing_stages")
    @classmethod
    def stages_are_valid_and_unique(cls, value: tuple[int, ...]) -> tuple[int, ...]:
        if any(stage < 1 or stage > 6 for stage in value):
            raise ValueError("stages must be between 1 and 6")
        if len(value) != len(set(value)):
            raise ValueError("stages must be unique")
        return value

    @model_validator(mode="after")
    def matches_public_contract(self) -> PublicRunProjection:
        completed = set(self.completed_stages)
        missing = set(self.missing_stages)
        if completed & missing:
            raise ValueError("completedStages and missingStages cannot overlap")
        if self.status is RunStatus.COMPLETE:
            if completed != set(range(1, 7)) or missing:
                raise ValueError("complete runs require all six stages")
            if self.project_slug is None or self.card_url is None:
                raise ValueError("complete runs require a published card URL")
        if self.status is RunStatus.PARTIAL and (
            not missing or self.project_slug is None or self.card_url is None
        ):
            raise ValueError("partial runs require missing stages and a card URL")
        if self.status is RunStatus.FAILED and (not self.public_failure_message or not missing):
            raise ValueError("failed runs require a safe failure message and missing stages")
        expected_fallback = "Previously generated — live refresh unavailable."
        if self.fallback_used and self.fallback_label != expected_fallback:
            raise ValueError("fallback runs require the exact approved fallback label")
        if not self.fallback_used and self.fallback_label is not None:
            raise ValueError("fallbackLabel is only allowed when fallbackUsed is true")
        return self
