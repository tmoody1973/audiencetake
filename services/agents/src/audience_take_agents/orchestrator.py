"""Deterministic six-stage ADK research and Scout Card orchestrator."""

from __future__ import annotations

import asyncio
import hashlib
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Protocol, cast
from urllib.parse import urlsplit

from google.adk.agents import SequentialAgent

from audience_take_agents.agents.provider import ModelOutputError, ResearchModelProvider
from audience_take_agents.agents.web_researcher import WebResearcher
from audience_take_agents.models import (
    ResearchBundle,
    ResearchInput,
    SourceAnalysis,
    SubmittedSource,
)
from audience_take_agents.publication import (
    EvidenceEditor,
    PathwayStrategist,
    PublicationCandidate,
    ScoutCardPublisher,
)
from audience_take_agents.publication.evidence_status import (
    derive_evidence_status,
    source_presentation,
)
from audience_take_agents.publication.media import project_submitted_media, youtube_video_id
from audience_take_agents.publication.project_profile import project_profile_from_analysis
from audience_take_agents.publication.schema import validate_schema
from audience_take_agents.runtime.models import EventKind, RunStatus
from audience_take_agents.tools.parallel_search import ParallelSearchError
from audience_take_agents.tools.source_reader import (
    SafeSourceReader,
    SourceReadError,
    UnsafeSourceError,
)
from audience_take_agents.trailer_critic import TrailerCriticService


class ResearchInputError(RuntimeError):
    """Approved run inputs are absent or inconsistent."""


class ResearchSliceFailure(RuntimeError):
    """A typed failure suitable for a safe HTTP retry/partial response."""

    def __init__(self, message: str, *, retryable: bool, partial: bool) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.partial = partial


class OrchestratorContext(Protocol):
    task: Any

    def heartbeat(self, stage: int | None = None) -> None: ...

    def load_stage_output(self, stage: int) -> Any | None: ...

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
    ) -> bool: ...

    def record_provider_success(self, *, request_count: int, source_count: int) -> None: ...

    def next_event_sequence(self) -> int: ...

    def finish(
        self,
        *,
        sequence: int,
        status: RunStatus,
        title: str,
        summary: str,
    ) -> bool: ...


class InputLoader(Protocol):
    async def load(self, run_id: str, project_id: str, research_version: int) -> ResearchInput: ...


class FirestoreInputLoader:
    """Loads only the accepted nomination referenced by the trusted run document."""

    def __init__(self, client: Any) -> None:
        self._client = client

    async def load(self, run_id: str, project_id: str, research_version: int) -> ResearchInput:
        return await asyncio.to_thread(self._load_sync, run_id, project_id, research_version)

    def _load_sync(self, run_id: str, project_id: str, research_version: int) -> ResearchInput:
        run_snapshot = self._client.collection("researchRuns").document(run_id).get()
        if not run_snapshot.exists:
            raise ResearchInputError("research run inputs are unavailable")
        run = cast(dict[str, Any], run_snapshot.to_dict())
        if run.get("projectId") != project_id or run.get("researchVersion") != research_version:
            raise ResearchInputError("research run inputs do not match the requested version")
        nomination_id = run.get("nominationId")
        if not isinstance(nomination_id, str) or not nomination_id:
            raise ResearchInputError("research run has no accepted nomination")
        nomination_snapshot = self._client.collection("nominations").document(nomination_id).get()
        if not nomination_snapshot.exists:
            raise ResearchInputError("accepted nomination inputs are unavailable")
        project_snapshot = self._client.collection("projects").document(project_id).get()
        if not project_snapshot.exists:
            raise ResearchInputError("research project inputs are unavailable")
        nomination = cast(dict[str, Any], nomination_snapshot.to_dict())
        project = cast(dict[str, Any], project_snapshot.to_dict())
        if nomination.get("projectId") != project_id or nomination.get("status") != "accepted":
            raise ResearchInputError("nomination is not approved for this research run")
        try:
            # Firestore nomination documents include trusted workflow metadata.
            # Whitelist only the public nomination contract before strict
            # validation so metadata cannot leak into the model handoff.
            return ResearchInput.model_validate(
                {
                    "projectSlug": project.get("slug"),
                    "submittedUrl": nomination.get("submittedUrl"),
                    "canonicalUrl": nomination.get("canonicalUrl"),
                    "mediaUrl": nomination.get("canonicalMediaUrl"),
                    "whyItShouldGrow": nomination.get("whyItShouldGrow"),
                    "submissionType": nomination.get("submissionType"),
                    "suggestedFormat": nomination.get("suggestedFormat"),
                    "audienceFit": nomination.get("audienceFit"),
                    "supportingUrls": nomination.get("supportingUrls", []),
                }
            )
        except ValueError as error:
            raise ResearchInputError("accepted nomination inputs are invalid") from error


class AudienceTakeOrchestrator:
    """Executes durable stages with explicit validated handoffs and honest recovery."""

    def __init__(
        self,
        *,
        input_loader: InputLoader,
        source_reader: SafeSourceReader,
        model_provider: ResearchModelProvider,
        web_researcher: WebResearcher,
        publisher: ScoutCardPublisher,
        adk_graph: SequentialAgent | None = None,
        trailer_critic: TrailerCriticService | None = None,
        clock: Any = lambda: datetime.now(UTC),
    ) -> None:
        self._input_loader = input_loader
        self._source_reader = source_reader
        self._model_provider = model_provider
        self._web_researcher = web_researcher
        self._publisher = publisher
        self.adk_graph = adk_graph
        self._trailer_critic = trailer_critic
        self._clock = clock

    async def execute(self, context: Any) -> None:
        durable_context = cast(OrchestratorContext, context)
        task = durable_context.task
        try:
            nomination = await self._input_loader.load(
                task.run_id,
                task.project_id,
                task.research_version,
            )
            completed_mapping = durable_context.load_stage_output(2)
            completed_read = durable_context.load_stage_output(1)
            completed_research = durable_context.load_stage_output(3)
            reusable_analysis = completed_mapping or completed_read
            if completed_research is not None:
                if reusable_analysis is None:
                    raise ModelOutputError("web research exists without source analysis")
                analysis = SourceAnalysis.model_validate(reusable_analysis.output)
                bundle = ResearchBundle.model_validate(completed_research.output)
                completed_receipt = bundle.tool_receipts[0]
                durable_context.record_provider_success(
                    request_count=1,
                    source_count=completed_receipt.result_count,
                )
            else:
                durable_context.heartbeat(1)
                read = await asyncio.to_thread(
                    self._source_reader.read, str(nomination.canonical_url)
                )
                source = SubmittedSource(
                    id=submitted_source_id(str(nomination.canonical_url)),
                    url=nomination.submitted_url,
                    canonicalUrl=nomination.canonical_url,
                    title=read.title,
                    excerpt=read.content[:500],
                    publishedAt=None,
                    retrievedAt=self._clock(),
                    content=read.content,
                )
                if reusable_analysis is not None:
                    analysis = SourceAnalysis.model_validate(reusable_analysis.output)
                else:
                    analysis = await self._model_provider.analyze_source(
                        run_id=task.run_id,
                        project_id=task.project_id,
                        research_version=task.research_version,
                        nomination=nomination,
                        source=source,
                    )
                    validate_analysis_scope(analysis, source.id)
                source_ids = tuple(analysis.source_ids)
                analysis_output = analysis.model_dump(by_alias=True, mode="json")
                if completed_read is None:
                    durable_context.persist_stage(
                        sequence=1,
                        stage=1,
                        output=analysis_output,
                        title="Submitted source read",
                        summary="The public project source was read within bounded safety limits.",
                        kind=EventKind.SOURCE_RECEIPT,
                        source_ids=source_ids,
                    )
                if completed_mapping is None:
                    durable_context.heartbeat(2)
                    durable_context.persist_stage(
                        sequence=2,
                        stage=2,
                        output=analysis_output,
                        title="Story and creator context mapped",
                        summary="Observed source context was separated from nominator assertions.",
                        source_ids=source_ids,
                    )
                durable_context.heartbeat(3)
                bundle = await self._web_researcher.research(analysis=analysis, submitted=source)
                receipt = bundle.tool_receipts[0]
                durable_context.record_provider_success(
                    request_count=1,
                    source_count=receipt.result_count,
                )
                durable_context.persist_stage(
                    sequence=3,
                    stage=3,
                    output=bundle.model_dump(by_alias=True, mode="json"),
                    title="Parallel searched the public web",
                    summary=(
                        f"Parallel returned {receipt.result_count} normalized public source"
                        f"{'s' if receipt.result_count != 1 else ''}."
                    ),
                    kind=EventKind.TOOL_RECEIPT,
                    tool_name=receipt.tool_name,
                    query_label=receipt.query_label,
                    result_count=receipt.result_count,
                    source_ids=tuple(receipt.source_ids),
                )
            await self._complete_evidence_pathways_and_publication(
                durable_context,
                nomination=nomination,
                analysis=analysis,
                bundle=bundle,
            )
        except ParallelSearchError as error:
            raise ResearchSliceFailure(
                "current-web research provider unavailable",
                retryable=error.retryable,
                partial=True,
            ) from error
        except UnsafeSourceError as error:
            raise ResearchSliceFailure(
                "submitted source is not safe for server-side reading",
                retryable=False,
                partial=False,
            ) from error
        except SourceReadError as error:
            raise ResearchSliceFailure(
                "submitted public source could not be read",
                retryable=True,
                partial=False,
            ) from error
        except ModelOutputError as error:
            raise ResearchSliceFailure(
                "research provider returned no valid structured output",
                retryable=True,
                partial=durable_context.load_stage_output(3) is not None,
            ) from error
        except ResearchInputError as error:
            raise ResearchSliceFailure(
                "approved research inputs are unavailable",
                retryable=False,
                partial=False,
            ) from error

    async def _complete_evidence_pathways_and_publication(
        self,
        context: OrchestratorContext,
        *,
        nomination: ResearchInput,
        analysis: SourceAnalysis,
        bundle: ResearchBundle,
    ) -> None:
        sources = normalize_publication_sources(bundle, nomination)
        project_profile = project_profile_from_analysis(analysis)
        completed_evidence = context.load_stage_output(4)
        if completed_evidence is not None:
            ledger = deepcopy(cast(dict[str, Any], completed_evidence.output))
            # Older completed stage-4 artifacts predate the profile contract.
            # Upgrade only the in-memory continuation; never rewrite durable history.
            ledger.setdefault("projectProfile", project_profile)
            validate_schema("evidence-ledger.schema.json", ledger)
        else:
            context.heartbeat(4)
            draft = await self._model_provider.draft_evidence(analysis, bundle)
            draft_payload = draft.model_dump(by_alias=True, mode="json")
            draft_claims = cast(list[dict[str, Any]], draft_payload["claims"])
            link_source_claims(sources, cast(list[dict[str, object]], draft_claims))
            ledger = EvidenceEditor().edit(
                run_id=bundle.run_id,
                project_id=bundle.project_id,
                research_version=bundle.research_version,
                sources=sources,
                claims=draft_claims,
                comparables=cast(list[dict[str, Any]], draft_payload["comparables"]),
                external_signals=cast(list[dict[str, Any]], draft_payload["externalSignals"]),
                project_profile=project_profile,
                limitations=cast(list[str], draft_payload["limitations"]),
                unresolved_questions=cast(list[str], draft_payload["unresolvedQuestions"]),
            )
            context.persist_stage(
                sequence=4,
                stage=4,
                output=ledger,
                title="Evidence and comparables checked",
                summary="Claims were qualified against cited public sources and limitations.",
                source_ids=tuple(source["id"] for source in sources),
            )
        link_source_claims(
            sources,
            cast(list[dict[str, object]], ledger["claims"]),
        )

        completed_pathways = context.load_stage_output(5)
        if completed_pathways is not None:
            pathway_payload = cast(dict[str, Any], completed_pathways.output)
            pathway_candidates = cast(list[dict[str, Any]], pathway_payload["pathways"])
        else:
            context.heartbeat(5)
            pathway_draft = await self._model_provider.draft_pathways(
                cast(dict[str, object], ledger),
                cast(list[dict[str, object]], sources),
            )
            pathway_candidates = cast(
                list[dict[str, Any]],
                pathway_draft.to_pathways(
                    run_id=bundle.run_id,
                    project_id=bundle.project_id,
                ),
            )
        pathways = PathwayStrategist().validate(
            pathway_candidates,
            evidence_ledger=ledger,
            sources=sources,
        )
        if completed_pathways is None:
            context.persist_stage(
                sequence=5,
                stage=5,
                output={"pathways": list(pathways)},
                title="Three development pathways built",
                summary="Three distinct evidence-linked hypotheses and experiments were prepared.",
                source_ids=tuple(source["id"] for source in sources),
            )

        context.heartbeat(6)
        published_at = max(source.retrieved_at for source in bundle.sources)
        card = assemble_scout_card(
            nomination=nomination,
            analysis=analysis,
            bundle=bundle,
            evidence_ledger=ledger,
            pathways=pathways,
            sources=sources,
            published_at=published_at,
        )
        decision, _ = await asyncio.to_thread(
            self._publisher.publish,
            PublicationCandidate(
                sources=tuple(sources),
                evidence_ledger=ledger,
                pathways=pathways,
                card=card,
            ),
            run_id=bundle.run_id,
            project_id=bundle.project_id,
            research_version=bundle.research_version,
            attempt=context.task.attempt,
            published_at=published_at,
            missing_sections=(
                ("parallel_web_sources",) if bundle.tool_receipts[0].result_count == 0 else ()
            ),
        )
        status = RunStatus(str(decision["outcome"]))
        context.finish(
            sequence=context.next_event_sequence(),
            status=status,
            title=(
                "Scout Card published"
                if status in {RunStatus.COMPLETE, RunStatus.PARTIAL}
                else "Scout Card publication incomplete"
            ),
            summary=str(decision["publicMessage"]),
        )
        if (
            self._trailer_critic is not None
            and status in {RunStatus.COMPLETE, RunStatus.PARTIAL}
            and card.get("primaryWorkSourceId")
            and youtube_video_id(str(card["media"]["sourceUrl"])) is not None
        ):
            try:
                await self._trailer_critic.analyze_and_publish(
                    project_id=bundle.project_id,
                    source_id=str(card["primaryWorkSourceId"]),
                    youtube_url=str(card["media"]["sourceUrl"]),
                )
            except Exception as error:  # noqa: BLE001 -- optional artifact cannot fail the card
                # Trailer Critic is an optional independent artifact. Its failure
                # must never roll back or misreport the completed Scout Card.
                print(
                    {
                        "severity": "WARNING",
                        "message": "optional trailer critic artifact was not published",
                        "projectId": bundle.project_id,
                        "errorType": type(error).__name__,
                    },
                    flush=True,
                )


def submitted_source_id(canonical_url: str) -> str:
    digest = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()[:16]
    return f"source-submitted-{digest}"


def assemble_scout_card(
    *,
    nomination: ResearchInput,
    analysis: SourceAnalysis,
    bundle: ResearchBundle,
    evidence_ledger: dict[str, Any],
    pathways: tuple[dict[str, Any], ...],
    sources: list[dict[str, Any]],
    published_at: datetime,
) -> dict[str, Any]:
    """Project validated stage artifacts into the immutable public card contract."""
    claims = [dict(item) for item in cast(list[dict[str, Any]], evidence_ledger["claims"])]
    claim_ids = [str(claim["id"]) for claim in claims]
    source_ids = [str(source["id"]) for source in sources]
    embedded_pathways = [
        {key: value for key, value in pathway.items() if key not in {"projectId", "runId"}}
        for pathway in pathways
    ]
    pathway_ids = [str(pathway["id"]) for pathway in embedded_pathways]
    limitations = _bounded_unique(
        cast(list[object], evidence_ledger.get("limitations", [])), limit=500
    )
    creator_limitations = _bounded_unique(list(analysis.limitations), limit=500)
    risks = _bounded_unique(
        [risk for pathway in embedded_pathways for risk in pathway.get("risks", [])],
        limit=500,
    )
    unresolved_questions = _bounded_unique(
        [
            *cast(list[object], evidence_ledger.get("unresolvedQuestions", [])),
            *[
                question
                for pathway in embedded_pathways
                for question in pathway.get("openQuestions", [])
            ],
        ],
        limit=500,
    )
    external_signals = [
        {
            key: signal[key]
            for key in (
                "label",
                "analysis",
                "sourceIds",
                "limitations",
                "nativeAudienceCount",
            )
        }
        for signal in cast(list[dict[str, Any]], evidence_ledger.get("externalSignals", []))
    ]
    signal_limitations = _bounded_unique(
        [
            *limitations,
            *[
                limitation
                for signal in external_signals
                for limitation in cast(list[object], signal["limitations"])
            ],
        ],
        limit=500,
    )
    comparables = [
        {key: comparable[key] for key in ("title", "relevance", "sourceIds", "limitations")}
        for comparable in cast(list[dict[str, Any]], evidence_ledger.get("comparables", []))
    ]
    confidence_rank = {"low": 0, "medium": 1, "high": 2}
    recommended_pathway = max(
        embedded_pathways,
        key=lambda pathway: (
            confidence_rank.get(str(pathway["confidence"]), -1),
            -int(pathway["order"]),
        ),
    )
    researched_at = published_at.isoformat().replace("+00:00", "Z")
    submitted_url = str(nomination.canonical_url)
    media_url = str(nomination.media_url or nomination.canonical_url)
    primary_work_source_id = next(
        (str(source["id"]) for source in sources if str(source.get("canonicalUrl")) == media_url),
        submitted_source_id(media_url),
    )
    title = analysis.identity.title
    return {
        "cardVersionId": f"card-{bundle.project_id}-v{bundle.research_version}",
        "runId": bundle.run_id,
        "researchVersion": bundle.research_version,
        "projectId": bundle.project_id,
        "slug": nomination.project_slug,
        "title": title,
        "hook": analysis.story_context.hook,
        "projectType": analysis.identity.project_type.value,
        "submissionLabel": (
            "Creator-submitted — verification pending"
            if nomination.submission_type == "creator"
            else "Fan nomination — unclaimed by creator"
        ),
        "claimStatus": analysis.creator_context.claim_status.value,
        "completeness": "complete",
        "structureStatus": "complete",
        "evidenceStatus": derive_evidence_status(evidence_ledger, sources),
        "identity": {"relationshipStatus": "unresolved"},
        "fallbackUsed": False,
        "provenance": {
            "submissionType": nomination.submission_type,
            "submittedSourceUrl": submitted_url,
            "nominationLabel": "Public project source submitted for scouting",
            "nominatedByLabel": (
                "Creator submission" if nomination.submission_type == "creator" else "Fan scout"
            ),
            "researchedAt": researched_at,
        },
        "primaryWorkSourceId": primary_work_source_id,
        "media": project_submitted_media(media_url, title),
        "storyContext": {
            "summary": analysis.story_context.synopsis,
            "storyworld": analysis.story_context.storyworld,
            "themes": _bounded_unique(list(analysis.story_context.themes), limit=160),
            "currentFormat": analysis.identity.current_format,
            "audienceHooks": _bounded_unique(
                list(analysis.story_context.audience_hooks), limit=240
            ),
            "claimIds": claim_ids,
        },
        "creatorContext": {
            "displayName": analysis.creator_context.display_name,
            "claimStatus": analysis.creator_context.claim_status.value,
            "summary": analysis.creator_context.observed_context,
            "sourceIds": list(analysis.creator_context.source_ids),
            "limitations": creator_limitations,
        },
        "sourceIds": source_ids,
        "claimIds": claim_ids,
        "evidenceClaims": claims,
        "externalSignals": external_signals,
        "pathwayIds": pathway_ids,
        "pathways": embedded_pathways,
        "sourceLedger": [
            {
                key: source[key]
                for key in (
                    "id",
                    "origin",
                    "title",
                    "url",
                    "publishedAt",
                    "retrievedAt",
                    "availability",
                    "verificationStatus",
                    "supportsClaimIds",
                    "externalCommentary",
                )
            }
            | source_presentation(source)
            for source in sources
        ],
        "missingSections": [],
        "limitations": limitations,
        "industryLens": {
            "pathwayIds": pathway_ids,
            "comparables": comparables,
            "risks": risks,
            "unresolvedQuestions": unresolved_questions,
            "signalLimitations": signal_limitations,
            "creatorClaimStatus": analysis.creator_context.claim_status.value,
            "recommendedNextExperiment": recommended_pathway["nextExperiment"],
        },
        "publishedAt": researched_at,
    }


def _bounded_unique(values: list[object], *, limit: int) -> list[str]:
    result: list[str] = []
    for value in values:
        text = str(value).strip()[:limit].rstrip()
        if text and text not in result:
            result.append(text)
    return result


def validate_analysis_scope(analysis: SourceAnalysis, submitted_source_id: str) -> None:
    allowed = {submitted_source_id}
    if set(analysis.source_ids) != allowed:
        raise ModelOutputError("source analysis referenced an unapproved source")
    if not set(analysis.creator_context.source_ids).issubset(allowed):
        raise ModelOutputError("creator context referenced an unapproved source")
    for observation in analysis.observations:
        if not set(observation.source_ids).issubset(allowed):
            raise ModelOutputError("source observation referenced an unapproved source")


def _submitted_source_type(url: str) -> str:
    if youtube_video_id(url) is not None:
        return "submitted_video"
    host = (urlsplit(url).hostname or "").casefold().removeprefix("www.")
    if host in {"kickstarter.com", "indiegogo.com"} or host.endswith(".kickstarter.com"):
        return "campaign"
    return "official_project"


def normalize_publication_sources(
    bundle: ResearchBundle, nomination: ResearchInput
) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for source in bundle.sources:
        host = urlsplit(str(source.canonical_url)).hostname or "unknown.invalid"
        sources.append(
            {
                "id": source.id,
                "projectId": bundle.project_id,
                "runId": bundle.run_id,
                "origin": source.origin.value,
                "url": str(source.url),
                "canonicalUrl": str(source.canonical_url),
                "domain": host,
                "title": source.title,
                "excerpt": source.excerpt,
                "author": None,
                "publishedAt": (
                    source.published_at.isoformat().replace("+00:00", "Z")
                    if source.published_at is not None
                    else None
                ),
                "retrievedAt": source.retrieved_at.isoformat().replace("+00:00", "Z"),
                "sourceType": (
                    _submitted_source_type(str(source.canonical_url))
                    if source.origin.value == "submitted"
                    else "other"
                ),
                "availability": "available",
                "verificationStatus": (
                    "qualified" if source.origin.value == "submitted" else "unverified"
                ),
                "supportsClaimIds": [],
                "conflictsWithClaimIds": [],
                "externalCommentary": False,
                "queryProvenance": (
                    source.query_provenance.model_dump(by_alias=True, mode="json")
                    if source.query_provenance is not None
                    else None
                ),
            }
        )
    if nomination.media_url is not None:
        media_url = str(nomination.media_url)
        if not any(str(source["canonicalUrl"]) == media_url for source in sources):
            retrieved_at = max(source.retrieved_at for source in bundle.sources)
            sources.append(
                {
                    "id": submitted_source_id(media_url),
                    "projectId": bundle.project_id,
                    "runId": bundle.run_id,
                    "origin": "submitted",
                    "url": media_url,
                    "canonicalUrl": media_url,
                    "domain": urlsplit(media_url).hostname or "youtube.com",
                    "title": "Submitted trailer or proof-of-concept video",
                    "excerpt": (
                        "Public YouTube video supplied with the original nomination "
                        "for the Scout Card player."
                    ),
                    "author": None,
                    "publishedAt": None,
                    "retrievedAt": retrieved_at.isoformat().replace("+00:00", "Z"),
                    "sourceType": "submitted_video",
                    "availability": "available",
                    "verificationStatus": "observed",
                    "supportsClaimIds": [],
                    "conflictsWithClaimIds": [],
                    "externalCommentary": False,
                    "queryProvenance": None,
                }
            )
    return sources


def link_source_claims(sources: list[dict[str, Any]], claims: list[dict[str, object]]) -> None:
    by_id = {str(source["id"]): source for source in sources}
    for claim in claims:
        claim_id = str(claim.get("id", ""))
        for source_id in cast(list[object], claim.get("sourceIds", [])):
            source = by_id.get(str(source_id))
            if source is None:
                continue
            linked = cast(list[str], source["supportsClaimIds"])
            if claim_id and claim_id not in linked:
                linked.append(claim_id)
