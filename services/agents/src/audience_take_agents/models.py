"""Structured handoffs for the minimum Audience Take research slice."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ProjectType(StrEnum):
    SERIES = "series"
    FILM = "film"
    SHORT_FILM = "short_film"
    DOCUMENTARY = "documentary"
    CREATOR_PROJECT = "creator_project"


class ProjectMedium(StrEnum):
    DOCUMENTARY = "documentary"
    LIVE_ACTION = "live_action"
    ANIMATION = "animation"
    HYBRID = "hybrid"
    UNKNOWN = "unknown"


class PathwayStrategy(StrEnum):
    DEVELOPMENT = "development"
    DISTRIBUTION = "distribution"
    AUDIENCE = "audience"
    FINANCING = "financing"
    EDUCATION = "education"
    ADAPTATION = "adaptation"


class ClaimStatus(StrEnum):
    UNCLAIMED = "unclaimed"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ObservationType(StrEnum):
    SOURCE_OBSERVED = "source_observed"
    NOMINATOR_ASSERTION = "nominator_assertion"


class SourceOrigin(StrEnum):
    SUBMITTED = "submitted"
    PARALLEL = "parallel"


class ProjectIdentity(StrictModel):
    title: str = Field(min_length=1, max_length=240)
    project_type: ProjectType = Field(alias="projectType")
    current_format: str = Field(alias="currentFormat", min_length=1, max_length=240)
    medium: str = Field(min_length=1, max_length=120)
    source_platform: str = Field(alias="sourcePlatform", min_length=1, max_length=120)


class StoryContext(StrictModel):
    hook: str = Field(min_length=1, max_length=500)
    synopsis: str = Field(min_length=1, max_length=1600)
    storyworld: str = Field(min_length=1, max_length=1200)
    themes: list[str]
    audience_hooks: list[str] = Field(alias="audienceHooks")


class CreatorContext(StrictModel):
    display_name: str | None = Field(alias="displayName", max_length=240)
    claim_status: ClaimStatus = Field(alias="claimStatus")
    observed_context: str = Field(alias="observedContext", min_length=1, max_length=1200)
    source_ids: list[str] = Field(alias="sourceIds")


class SourceObservation(StrictModel):
    id: str = Field(min_length=1)
    statement: str = Field(min_length=1, max_length=1200)
    observation_type: ObservationType = Field(alias="observationType")
    source_ids: list[str] = Field(alias="sourceIds", min_length=1)
    requires_verification: bool = Field(alias="requiresVerification")


class SourceAnalysis(StrictModel):
    run_id: str = Field(alias="runId", min_length=1)
    project_id: str = Field(alias="projectId", min_length=1)
    research_version: int = Field(alias="researchVersion", ge=1)
    source_ids: list[str] = Field(alias="sourceIds", min_length=1)
    identity: ProjectIdentity
    story_context: StoryContext = Field(alias="storyContext")
    creator_context: CreatorContext = Field(alias="creatorContext")
    observations: list[SourceObservation] = Field(min_length=1)
    research_questions: list[str] = Field(alias="researchQuestions", min_length=1)
    limitations: list[str] = Field(min_length=1)

    @field_validator("source_ids", "research_questions", "limitations")
    @classmethod
    def unique_strings(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("items must be unique")
        return values


class ResearchObjective(StrictModel):
    label: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=800)


class QueryPlan(StrictModel):
    objective: ResearchObjective
    label: str = Field(min_length=1, max_length=160)
    search_queries: list[str] = Field(alias="searchQueries", min_length=2, max_length=3)

    @field_validator("search_queries")
    @classmethod
    def bounded_diverse_queries(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values]
        if len({value.casefold() for value in normalized}) != len(normalized):
            raise ValueError("search queries must be unique")
        if any(not 2 <= len(value) <= 120 for value in normalized):
            raise ValueError("search queries must contain 2 to 120 characters")
        token_sets = [
            {token for token in value.casefold().split() if token} for value in normalized
        ]
        for index, left in enumerate(token_sets):
            for right in token_sets[index + 1 :]:
                union = left | right
                if union and len(left & right) / len(union) >= 0.8:
                    raise ValueError("search queries must cover diverse public-web angles")
        return normalized


class QueryProvenance(StrictModel):
    provider: str = Field(pattern="^parallel$")
    query_batch_id: str = Field(alias="queryBatchId", min_length=1)
    query_label: str = Field(alias="queryLabel", min_length=1, max_length=160)


class ResearchSource(StrictModel):
    id: str = Field(min_length=1)
    origin: SourceOrigin
    url: HttpUrl
    canonical_url: HttpUrl = Field(alias="canonicalUrl")
    title: str = Field(min_length=1, max_length=500)
    excerpt: str = Field(min_length=1, max_length=2000)
    published_at: datetime | None = Field(alias="publishedAt")
    retrieved_at: datetime = Field(alias="retrievedAt")
    query_provenance: QueryProvenance | None = Field(alias="queryProvenance")

    @field_validator("query_provenance")
    @classmethod
    def provenance_is_valid(
        cls, value: QueryProvenance | None, info: object
    ) -> QueryProvenance | None:
        # Cross-field provenance is additionally enforced by ResearchBundle.
        return value


class QueryBatch(StrictModel):
    id: str = Field(min_length=1)
    provider: str = Field(pattern="^parallel$")
    label: str = Field(min_length=1, max_length=160)
    search_queries: list[str] = Field(alias="searchQueries", min_length=2, max_length=3)
    source_ids: list[str] = Field(alias="sourceIds")


class ToolReceipt(StrictModel):
    tool_name: str = Field(alias="toolName", pattern="^Parallel Search$")
    query_batch_id: str = Field(alias="queryBatchId", min_length=1)
    query_label: str = Field(alias="queryLabel", min_length=1, max_length=160)
    result_count: int = Field(alias="resultCount", ge=0)
    source_ids: list[str] = Field(alias="sourceIds")


class ResearchBundle(StrictModel):
    run_id: str = Field(alias="runId", min_length=1)
    project_id: str = Field(alias="projectId", min_length=1)
    research_version: int = Field(alias="researchVersion", ge=1)
    objective: ResearchObjective
    query_batches: list[QueryBatch] = Field(alias="queryBatches", min_length=1)
    sources: list[ResearchSource]
    tool_receipts: list[ToolReceipt] = Field(alias="toolReceipts", min_length=1)
    limitations: list[str] = Field(min_length=1)

    @field_validator("sources")
    @classmethod
    def source_provenance_matches_origin(
        cls, sources: list[ResearchSource]
    ) -> list[ResearchSource]:
        for source in sources:
            if source.origin is SourceOrigin.PARALLEL and source.query_provenance is None:
                raise ValueError("Parallel sources require query provenance")
            if source.origin is SourceOrigin.SUBMITTED and source.query_provenance is not None:
                raise ValueError("submitted sources cannot have Parallel provenance")
        return sources


class SubmittedSource(StrictModel):
    id: str = Field(min_length=1)
    url: HttpUrl
    canonical_url: HttpUrl = Field(alias="canonicalUrl")
    title: str = Field(min_length=1, max_length=500)
    excerpt: str = Field(min_length=1, max_length=2000)
    published_at: datetime | None = Field(default=None, alias="publishedAt")
    retrieved_at: datetime = Field(alias="retrievedAt")
    content: str = Field(min_length=1, max_length=32_000)


class ResearchInput(StrictModel):
    project_slug: str = Field(
        alias="projectSlug",
        min_length=1,
        max_length=200,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    submitted_url: HttpUrl = Field(alias="submittedUrl")
    canonical_url: HttpUrl = Field(alias="canonicalUrl")
    media_url: HttpUrl | None = Field(default=None, alias="mediaUrl")
    why_it_should_grow: str = Field(alias="whyItShouldGrow", min_length=1, max_length=600)
    submission_type: str = Field(alias="submissionType", pattern="^(fan|creator)$")
    suggested_format: str | None = Field(default=None, alias="suggestedFormat", max_length=400)
    audience_fit: str | None = Field(default=None, alias="audienceFit", max_length=400)
    supporting_urls: list[HttpUrl] = Field(default_factory=list, alias="supportingUrls")


class ProviderFailure(StrictModel):
    provider: str
    code: str
    message: str
    retryable: bool
    partial: bool


EvidenceId = Annotated[str, Field(min_length=1, max_length=200)]
EvidenceText = Annotated[str, Field(min_length=1, max_length=500)]
PathwayText = Annotated[str, Field(min_length=1, max_length=300)]


class EvidenceClaimDraft(StrictModel):
    id: EvidenceId
    statement: str = Field(min_length=1, max_length=1200)
    # The normalized live-research bundle contains qualified/unverified leads,
    # not independently verified or pre-declared conflicting sources. Do not
    # offer statuses that the deterministic editor must reject for this stage.
    status: Literal["qualified", "unsupported", "inference"]
    source_ids: list[EvidenceId] = Field(alias="sourceIds", min_length=1, max_length=10)
    qualification: str = Field(min_length=1, max_length=1000)


class ComparableDraft(StrictModel):
    id: EvidenceId
    title: str = Field(min_length=1, max_length=240)
    relevance: str = Field(min_length=1, max_length=800)
    source_ids: list[EvidenceId] = Field(alias="sourceIds", min_length=1, max_length=10)
    limitations: list[EvidenceText] = Field(min_length=1, max_length=4)


class ExternalSignalDraft(StrictModel):
    id: EvidenceId
    label: str = Field(min_length=1, max_length=200)
    analysis: str = Field(min_length=1, max_length=1000)
    source_ids: list[EvidenceId] = Field(alias="sourceIds", min_length=1, max_length=10)
    limitations: list[EvidenceText] = Field(min_length=1, max_length=4)
    # Google Gen AI converts Literal values into string enums and rejects
    # Literal[False] before a Vertex request is sent. Keep the transport schema
    # a normal boolean, then enforce the invariant locally after generation.
    native_audience_count: bool = Field(alias="nativeAudienceCount", strict=True)

    @field_validator("native_audience_count")
    @classmethod
    def external_signal_is_never_native(cls, value: bool) -> bool:
        if value is not False:
            raise ValueError("external signals cannot be native audience counts")
        return value


class EvidenceDraft(StrictModel):
    claims: list[EvidenceClaimDraft] = Field(min_length=1, max_length=6)
    comparables: list[ComparableDraft] = Field(default_factory=list, max_length=3)
    external_signals: list[ExternalSignalDraft] = Field(
        default_factory=list, alias="externalSignals", max_length=3
    )
    limitations: list[EvidenceText] = Field(min_length=1, max_length=6)
    unresolved_questions: list[EvidenceText] = Field(
        alias="unresolvedQuestions", min_length=1, max_length=6
    )


class NextExperimentDraft(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    hypothesis: str = Field(min_length=1, max_length=400)
    method: str = Field(min_length=1, max_length=500)
    participant_action: str = Field(alias="participantAction", min_length=1, max_length=300)
    signal: str = Field(min_length=1, max_length=300)
    timebox: str = Field(min_length=1, max_length=80)


class PathwayContentDraft(StrictModel):
    audience: str = Field(min_length=1, max_length=240)
    rationale: str = Field(min_length=1, max_length=600)
    supporting_claim_ids: list[EvidenceId] = Field(
        alias="supportingClaimIds", min_length=1, max_length=3
    )
    comparable_source_ids: list[EvidenceId] = Field(
        default_factory=list, alias="comparableSourceIds", max_length=2
    )
    strengths: list[PathwayText] = Field(min_length=1, max_length=2)
    risks: list[PathwayText] = Field(min_length=1, max_length=2)
    open_questions: list[PathwayText] = Field(alias="openQuestions", min_length=1, max_length=2)
    confidence: Literal["low", "medium", "high"]
    next_experiment: NextExperimentDraft = Field(alias="nextExperiment")


class PathwayDirectionDraft(PathwayContentDraft):
    label: str = Field(min_length=1, max_length=160)
    format: str = Field(min_length=1, max_length=160)
    strategy_kind: PathwayStrategy = Field(alias="strategyKind")
    proposed_medium: ProjectMedium = Field(alias="proposedMedium")
    cross_format: bool = Field(alias="crossFormat", strict=True)
    cross_format_claim_ids: list[EvidenceId] = Field(
        default_factory=list, alias="crossFormatClaimIds", max_length=2
    )


class PathwayDraft(StrictModel):
    """Exactly three bounded, project-native pathway directions."""

    pathways: list[PathwayDirectionDraft] = Field(min_length=3, max_length=3)

    def to_pathways(self, *, run_id: str, project_id: str) -> list[dict[str, object]]:
        return [
            {
                "id": f"pathway-{order:02d}",
                "projectId": project_id,
                "runId": run_id,
                "order": order,
                **pathway.model_dump(by_alias=True, mode="json"),
            }
            for order, pathway in enumerate(self.pathways, start=1)
        ]


CriticText = Annotated[str, Field(min_length=1, max_length=800)]
Timestamp = Annotated[str, Field(pattern=r"^\d{2}:\d{2}$")]


def _timestamp_seconds(value: str) -> int:
    minutes, seconds = (int(part) for part in value.split(":"))
    if seconds >= 60:
        raise ValueError("timestamp seconds must be below 60")
    return minutes * 60 + seconds


class TrailerBeat(StrictModel):
    label: str = Field(min_length=1, max_length=120)
    start: Timestamp
    end: Timestamp
    observation: CriticText
    modality: Literal["visual", "audio", "audiovisual"]

    @model_validator(mode="after")
    def timestamps_are_ordered(self) -> TrailerBeat:
        if _timestamp_seconds(self.end) < _timestamp_seconds(self.start):
            raise ValueError("trailer beat end must not precede its start")
        return self


class StructuralNarrativeCritique(StrictModel):
    genre_signaling: CriticText = Field(alias="genreSignaling")
    narrative_delivery: CriticText = Field(alias="narrativeDelivery")
    trailer_type: CriticText = Field(alias="trailerType")
    beats: list[TrailerBeat] = Field(min_length=2, max_length=6)

    @field_validator("beats")
    @classmethod
    def beats_are_chronological(cls, beats: list[TrailerBeat]) -> list[TrailerBeat]:
        starts = [_timestamp_seconds(beat.start) for beat in beats]
        if starts != sorted(starts):
            raise ValueError("trailer beats must be chronological")
        return beats


class TechnicalCraftCritique(StrictModel):
    editing_and_pace: CriticText = Field(alias="editingAndPace")
    cinematography_and_framing: CriticText = Field(alias="cinematographyAndFraming")
    sound_and_score: CriticText = Field(alias="soundAndScore")
    graphics_and_titles: CriticText = Field(alias="graphicsAndTitles")


class MarketingPersuasionCritique(StrictModel):
    unique_selling_proposition: CriticText = Field(alias="uniqueSellingProposition")
    target_audience_hypothesis: CriticText = Field(alias="targetAudienceHypothesis")
    concept_vs_star_emphasis: CriticText = Field(alias="conceptVsStarEmphasis")
    representation_caveat: CriticText = Field(alias="representationCaveat")


class EmotionalRhetoricalCritique(StrictModel):
    emotional_hook: CriticText = Field(alias="emotionalHook")
    tone_and_mood_balance: CriticText = Field(alias="toneAndMoodBalance")
    persuasive_argument: CriticText = Field(alias="persuasiveArgument")


MatrixCategory = Literal[
    "genre",
    "narrative_stance",
    "usp",
    "target_audience",
    "sound_music",
    "camera_editing",
]


class CriticMatrixRow(StrictModel):
    category: MatrixCategory
    analysis: str = Field(min_length=1, max_length=500)


class TrailerCriticDraft(StrictModel):
    structural_narrative: StructuralNarrativeCritique = Field(alias="structuralNarrative")
    technical_craft: TechnicalCraftCritique = Field(alias="technicalCraft")
    marketing_persuasion: MarketingPersuasionCritique = Field(alias="marketingPersuasion")
    emotional_rhetorical: EmotionalRhetoricalCritique = Field(alias="emotionalRhetorical")
    matrix: list[CriticMatrixRow] = Field(min_length=6, max_length=6)
    source_ids: list[EvidenceId] = Field(alias="sourceIds", max_length=12)
    limitations: list[EvidenceText] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def matrix_and_sources_are_unique(self) -> TrailerCriticDraft:
        expected = [
            "genre",
            "narrative_stance",
            "usp",
            "target_audience",
            "sound_music",
            "camera_editing",
        ]
        if [row.category for row in self.matrix] != expected:
            raise ValueError("critic matrix must contain the six ordered categories")
        if len(self.source_ids) != len(set(self.source_ids)):
            raise ValueError("sourceIds must be unique")
        return self
