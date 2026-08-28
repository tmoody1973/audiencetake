from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

from audience_take_agents.agents.web_researcher import WebResearcher
from audience_take_agents.models import (
    EvidenceDraft,
    PathwayDraft,
    QueryPlan,
    ResearchBundle,
    ResearchInput,
    SourceAnalysis,
    SubmittedSource,
)
from audience_take_agents.orchestrator import (
    AudienceTakeOrchestrator,
    FirestoreInputLoader,
    ResearchSliceFailure,
)
from audience_take_agents.publication import InMemoryPublicationStore, ScoutCardPublisher
from audience_take_agents.publication.media import (
    privacy_enhanced_youtube_embed,
    project_submitted_media,
    youtube_video_id,
)
from audience_take_agents.runtime.models import (
    EventKind,
    ResearchTaskRequest,
    RunStatus,
    TaskDelivery,
)
from audience_take_agents.runtime.service import ResearchTaskRuntime
from audience_take_agents.runtime.store import InMemoryRuntimeStore
from audience_take_agents.tools.parallel_search import ParallelSearchClient, TransportResponse
from audience_take_agents.tools.source_reader import HttpResponse, SafeSourceReader

ROOT = Path(__file__).resolve().parents[3]
NOW = datetime(2026, 8, 26, 17, 0, tzinfo=UTC)


class FakeSnapshot:
    def __init__(self, data: dict[str, Any] | None) -> None:
        self.exists = data is not None
        self._data = data

    def to_dict(self) -> dict[str, Any] | None:
        return self._data


class FakeDocument:
    def __init__(self, data: dict[str, Any] | None) -> None:
        self._data = data

    def get(self) -> FakeSnapshot:
        return FakeSnapshot(self._data)


class FakeCollection:
    def __init__(self, documents: dict[str, dict[str, Any]]) -> None:
        self._documents = documents

    def document(self, document_id: str) -> FakeDocument:
        return FakeDocument(self._documents.get(document_id))


class FakeFirestoreInputClient:
    def __init__(self, collections: dict[str, dict[str, dict[str, Any]]]) -> None:
        self._collections = collections

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self._collections.get(name, {}))


def test_firestore_input_loader_whitelists_nomination_fields() -> None:
    client = FakeFirestoreInputClient(
        {
            "researchRuns": {
                "run-1": {
                    "projectId": "project-1",
                    "researchVersion": 1,
                    "nominationId": "nomination-1",
                }
            },
            "nominations": {
                "nomination-1": {
                    "projectId": "project-1",
                    "status": "accepted",
                    "visibility": "public",
                    "nominatorUid": "private-workflow-field",
                    "submittedUrl": "https://example.com/project",
                    "canonicalUrl": "https://example.com/project",
                    "canonicalMediaUrl": "https://www.youtube.com/watch?v=s8G7425lfKs",
                    "whyItShouldGrow": "A distinct public project worth scouting.",
                    "submissionType": "fan",
                    "supportingUrls": [],
                    "createdAt": NOW,
                }
            },
            "projects": {"project-1": {"slug": "project-junichiro-live"}},
        }
    )

    result = asyncio.run(FirestoreInputLoader(client).load("run-1", "project-1", 1))

    assert result.canonical_url.unicode_string() == "https://example.com/project"
    assert result.media_url is not None
    assert result.media_url.unicode_string() == "https://www.youtube.com/watch?v=s8G7425lfKs"
    assert result.project_slug == "project-junichiro-live"
    assert result.submission_type == "fan"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.youtube.com/watch?v=s8G7425lfKs", "s8G7425lfKs"),
        ("https://youtu.be/s8G7425lfKs?t=5", "s8G7425lfKs"),
        ("https://youtube.com/shorts/s8G7425lfKs", "s8G7425lfKs"),
        ("https://m.youtube.com/live/s8G7425lfKs", "s8G7425lfKs"),
        ("https://www.youtube.com/embed/s8G7425lfKs", "s8G7425lfKs"),
        ("https://www.youtube-nocookie.com/embed/s8G7425lfKs", "s8G7425lfKs"),
    ],
)
def test_youtube_video_id_accepts_supported_first_party_urls(
    url: str, expected: str
) -> None:
    assert youtube_video_id(url) == expected
    assert privacy_enhanced_youtube_embed(url) == (
        "https://www.youtube-nocookie.com/embed/s8G7425lfKs"
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://youtube.example/watch?v=s8G7425lfKs",
        "https://youtube.com.example/watch?v=s8G7425lfKs",
        "https://user:password@youtube.com/watch?v=s8G7425lfKs",
        "javascript:alert(1)",
        "https://youtube.com/watch?v=too-short",
    ],
)
def test_youtube_video_id_rejects_unsafe_or_unsupported_urls(url: str) -> None:
    assert youtube_video_id(url) is None


def test_submitted_media_falls_back_for_non_youtube_sources() -> None:
    media = project_submitted_media("https://example.com/project", "Example")

    assert media["state"] == "editorial_fallback"
    assert "embedUrl" not in media


class FakeInputLoader:
    async def load(self, run_id: str, project_id: str, research_version: int) -> ResearchInput:
        assert (run_id, project_id, research_version) == ("run-junichiro-v1", "junichiro-jackson", 1)
        return ResearchInput(
            projectSlug="project-junichiro-live",
            submittedUrl="https://www.youtube.com/watch?v=M2djoKmnOTY",
            canonicalUrl="https://www.youtube.com/watch?v=M2djoKmnOTY",
            whyItShouldGrow="The public concept has a distinct storyworld.",
            submissionType="fan",
            supportingUrls=[],
        )


class FakeSourceTransport:
    def get(self, url: str, *, max_bytes: int, timeout_seconds: float) -> HttpResponse:
        del max_bytes, timeout_seconds
        return HttpResponse(
            url=url,
            status=200,
            content_type="text/html",
            body=b"<title>Junichiro Jackson</title><p>Public project story material.</p>",
        )


class FakeParallelTransport:
    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any],
        timeout_seconds: float,
    ) -> TransportResponse:
        del url, headers, json_body, timeout_seconds
        return TransportResponse(
            status_code=200,
            payload={
                "search_id": "fixture-search",
                "results": [
                    {
                        "url": "https://example.com/project-profile",
                        "title": "Project profile",
                        "publish_date": None,
                        "excerpts": ["A current public project profile."],
                    }
                ],
            },
        )


class FailingParallelTransport:
    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any],
        timeout_seconds: float,
    ) -> TransportResponse:
        del url, headers, json_body, timeout_seconds
        return TransportResponse(status_code=503, payload={})


class FakeModelProvider:
    async def analyze_source(
        self,
        *,
        run_id: str,
        project_id: str,
        research_version: int,
        nomination: ResearchInput,
        source: SubmittedSource,
    ) -> SourceAnalysis:
        del nomination
        payload = json.loads((ROOT / "contracts/fixtures/junichiro-source-analysis.json").read_text())
        payload.update(
            {
                "runId": run_id,
                "projectId": project_id,
                "researchVersion": research_version,
                "sourceIds": [source.id],
            }
        )
        for observation in payload["observations"]:
            observation["sourceIds"] = [source.id]
        payload["creatorContext"]["sourceIds"] = [source.id]
        return SourceAnalysis.model_validate(payload)

    async def plan_queries(self, analysis: SourceAnalysis) -> QueryPlan:
        del analysis
        return QueryPlan(
            objective={
                "label": "Verify public context",
                "description": "Verify current project, creator, and comparable context.",
            },
            label="project identity and structural context",
            searchQueries=["Junichiro Jackson animation", "adult animation comparable"],
        )

    async def draft_evidence(
        self, analysis: SourceAnalysis, bundle: ResearchBundle
    ) -> EvidenceDraft:
        del bundle
        payload = json.loads((ROOT / "contracts/fixtures/junichiro-evidence-ledger.json").read_text())
        old_source = "source-youtube-trailer"
        new_source = analysis.source_ids[0]
        payload = json.loads(json.dumps(payload).replace(old_source, new_source))
        return EvidenceDraft(
            claims=payload["claims"],
            comparables=payload["comparables"],
            externalSignals=payload["externalSignals"],
            limitations=payload["limitations"],
            unresolvedQuestions=payload["unresolvedQuestions"],
        )

    async def draft_pathways(
        self, evidence_ledger: dict[str, object], sources: list[dict[str, object]]
    ) -> PathwayDraft:
        del sources
        card = json.loads((ROOT / "contracts/fixtures/junichiro-card.json").read_text())
        source_id = cast(list[dict[str, Any]], evidence_ledger["claims"])[0]["sourceIds"][0]
        pathways: list[dict[str, Any]] = []
        for embedded in card["pathways"]:
            pathway = json.loads(
                json.dumps(embedded).replace("source-youtube-trailer", str(source_id))
            )
            pathway["projectId"] = evidence_ledger["projectId"]
            pathway["runId"] = evidence_ledger["runId"]
            pathways.append(pathway)
        contents = [
            {
                key: value
                for key, value in pathway.items()
                if key not in {"id", "projectId", "runId", "order"}
            }
            for pathway in pathways
        ]
        return PathwayDraft(pathways=contents)

class FakeContext:
    def __init__(self) -> None:
        self.task = SimpleNamespace(
            run_id="run-junichiro-v1",
            project_id="junichiro-jackson",
            research_version=1,
            attempt=1,
        )
        self.heartbeats: list[int | None] = []
        self.stages: list[dict[str, Any]] = []
        self.proof: list[tuple[int, int]] = []
        self.terminal: tuple[int, RunStatus] | None = None
        self.outputs: dict[int, Any] = {}

    def heartbeat(self, stage: int | None = None) -> None:
        self.heartbeats.append(stage)

    def load_stage_output(self, stage: int) -> Any | None:
        return self.outputs.get(stage)

    def persist_stage(self, **kwargs: Any) -> bool:
        self.stages.append(kwargs)
        self.outputs[int(kwargs["stage"])] = SimpleNamespace(output=kwargs["output"])
        return True

    def record_provider_success(self, *, request_count: int, source_count: int) -> None:
        self.proof.append((request_count, source_count))

    def next_event_sequence(self) -> int:
        return max((int(stage["sequence"]) for stage in self.stages), default=0) + 1

    def finish(
        self,
        *,
        sequence: int,
        status: RunStatus,
        title: str,
        summary: str,
    ) -> bool:
        del title, summary
        self.terminal = (sequence, status)
        return True


def test_orchestrator_persists_separate_stages_receipts_and_success_proof() -> None:
    provider = FakeModelProvider()
    parallel = ParallelSearchClient(api_key="key", transport=FakeParallelTransport())
    publication_store = InMemoryPublicationStore()
    researcher = WebResearcher(
        model_provider=provider,
        parallel=parallel,
        clock=lambda: NOW,
    )
    orchestrator = AudienceTakeOrchestrator(
        input_loader=FakeInputLoader(),
        source_reader=SafeSourceReader(transport=FakeSourceTransport()),
        model_provider=provider,
        web_researcher=researcher,
        publisher=ScoutCardPublisher(publication_store),
        clock=lambda: NOW,
    )
    context = FakeContext()

    asyncio.run(orchestrator.execute(context))

    assert context.heartbeats == [1, 2, 3, 4, 5, 6]
    assert [stage["stage"] for stage in context.stages] == [1, 2, 3, 4, 5]
    assert [stage["sequence"] for stage in context.stages] == [1, 2, 3, 4, 5]
    assert context.stages[0]["kind"] is EventKind.SOURCE_RECEIPT
    assert context.stages[1]["output"]["identity"]["title"] == "Junichiro Jackson"
    assert context.stages[2]["kind"] is EventKind.TOOL_RECEIPT
    assert context.stages[2]["tool_name"] == "Parallel Search"
    assert context.proof == [(1, 1)]
    assert context.terminal == (6, RunStatus.COMPLETE)
    card = publication_store.card("card-junichiro-jackson-v1")
    assert card is not None and card["slug"] == "project-junichiro-live"
    assert card["structureStatus"] == "complete"
    assert card["evidenceStatus"] == "source_limited"
    assert card["identity"] == {"relationshipStatus": "unresolved"}
    assert card["sourceLedger"][0]["sourceRole"] == "primary_work"
    assert card["sourceLedger"][0]["sourceTier"] == "platform_metadata"
    assert card["media"] == {
        "state": "authorized_embed",
        "title": "Watch the submitted public source for Junichiro Jackson",
        "sourceUrl": "https://www.youtube.com/watch?v=M2djoKmnOTY",
        "embedUrl": "https://www.youtube-nocookie.com/embed/M2djoKmnOTY",
        "attribution": (
            "Embedded from the fan-submitted public YouTube source; "
            "Audience Take does not rehost the video."
        ),
        "accessibleFallback": (
            "Open the submitted source on YouTube if the embedded player is unavailable."
        ),
    }
    public_payload = json.dumps(context.stages)
    assert "server-secret" not in public_payload
    assert "instruction" not in public_payload.casefold()
    assert "reasoning" not in public_payload.casefold()


class CampaignAndVideoInputLoader:
    async def load(
        self, run_id: str, project_id: str, research_version: int
    ) -> ResearchInput:
        assert (run_id, project_id, research_version) == (
            "run-junichiro-v1",
            "junichiro-jackson",
            1,
        )
        return ResearchInput(
            projectSlug="project-junichiro-live",
            submittedUrl="https://www.kickstarter.com/projects/teamto/junichiro-live",
            canonicalUrl="https://www.kickstarter.com/projects/teamto/junichiro-live",
            mediaUrl="https://www.youtube.com/watch?v=s8G7425lfKs",
            whyItShouldGrow="The campaign and proof of concept show a distinct storyworld.",
            submissionType="fan",
            supportingUrls=[],
        )


def test_orchestrator_keeps_campaign_provenance_and_uses_separate_video() -> None:
    provider = FakeModelProvider()
    publication_store = InMemoryPublicationStore()
    orchestrator = AudienceTakeOrchestrator(
        input_loader=CampaignAndVideoInputLoader(),
        source_reader=SafeSourceReader(transport=FakeSourceTransport()),
        model_provider=provider,
        web_researcher=WebResearcher(
            model_provider=provider,
            parallel=ParallelSearchClient(api_key="key", transport=FakeParallelTransport()),
            clock=lambda: NOW,
        ),
        publisher=ScoutCardPublisher(publication_store),
        clock=lambda: NOW,
    )

    asyncio.run(orchestrator.execute(FakeContext()))

    card = publication_store.card("card-junichiro-jackson-v1")
    assert card is not None
    assert card["provenance"]["submittedSourceUrl"].startswith("https://www.kickstarter.com/")
    assert card["media"]["sourceUrl"] == "https://www.youtube.com/watch?v=s8G7425lfKs"
    assert card["media"]["embedUrl"] == "https://www.youtube-nocookie.com/embed/s8G7425lfKs"
    assert len(card["sourceLedger"]) >= 2
    campaign_source = next(
        source for source in card["sourceLedger"] if "kickstarter.com" in source["url"]
    )
    video_source = next(
        source for source in card["sourceLedger"] if "youtube.com" in source["url"]
    )
    assert campaign_source["sourceRole"] == "other"
    assert video_source["sourceRole"] == "primary_work"
    assert card["primaryWorkSourceId"] == video_source["id"]


def test_orchestrator_never_increments_proof_for_failed_parallel_call() -> None:
    provider = FakeModelProvider()

    async def no_sleep(delay: float) -> None:
        del delay

    parallel = ParallelSearchClient(
        api_key="key",
        transport=FailingParallelTransport(),
        sleep=no_sleep,
        max_attempts=2,
    )
    orchestrator = AudienceTakeOrchestrator(
        input_loader=FakeInputLoader(),
        source_reader=SafeSourceReader(transport=FakeSourceTransport()),
        model_provider=provider,
        web_researcher=WebResearcher(
            model_provider=provider,
            parallel=parallel,
            clock=lambda: NOW,
        ),
        publisher=ScoutCardPublisher(InMemoryPublicationStore()),
        clock=lambda: NOW,
    )
    context = FakeContext()

    try:
        asyncio.run(orchestrator.execute(context))
    except ResearchSliceFailure as error:
        assert error.retryable is True
        assert error.partial is True
    else:
        raise AssertionError("failed Parallel call must remain an honest typed failure")

    assert context.proof == []
    assert [stage["stage"] for stage in context.stages] == [1, 2]
    assert context.terminal is None


def test_completed_stage_three_recovery_reasserts_idempotent_provider_proof() -> None:
    provider = FakeModelProvider()
    parallel = ParallelSearchClient(api_key="key", transport=FakeParallelTransport())
    orchestrator = AudienceTakeOrchestrator(
        input_loader=FakeInputLoader(),
        source_reader=SafeSourceReader(transport=FakeSourceTransport()),
        model_provider=provider,
        web_researcher=WebResearcher(
            model_provider=provider,
            parallel=parallel,
            clock=lambda: NOW,
        ),
        publisher=ScoutCardPublisher(InMemoryPublicationStore()),
        clock=lambda: NOW,
    )
    first = FakeContext()
    asyncio.run(orchestrator.execute(first))
    recovery = FakeContext()
    recovery.outputs = {stage: first.outputs[stage] for stage in (1, 2, 3)}

    asyncio.run(orchestrator.execute(recovery))

    assert recovery.proof == [(1, 1)]
    assert [stage["stage"] for stage in recovery.stages] == [4, 5]
    assert recovery.terminal == (6, RunStatus.COMPLETE)


def test_orchestrator_executes_through_concrete_durable_runtime() -> None:
    provider = FakeModelProvider()
    executor = AudienceTakeOrchestrator(
        input_loader=FakeInputLoader(),
        source_reader=SafeSourceReader(transport=FakeSourceTransport()),
        model_provider=provider,
        web_researcher=WebResearcher(
            model_provider=provider,
            parallel=ParallelSearchClient(api_key="key", transport=FakeParallelTransport()),
            clock=lambda: NOW,
        ),
        publisher=ScoutCardPublisher(InMemoryPublicationStore()),
        clock=lambda: NOW,
    )
    task = ResearchTaskRequest(
        runId="run-junichiro-v1",
        projectId="junichiro-jackson",
        attempt=1,
        researchVersion=1,
        taskName="research-run-junichiro-v1-attempt-1",
    )
    delivery = TaskDelivery(
        full_task_name=f"projects/demo/locations/us/queues/research/tasks/{task.task_name}",
        queue_name="projects/demo/locations/us/queues/research",
        retry_count=0,
    )
    store = InMemoryRuntimeStore()
    store.seed_run(task)
    runtime = ResearchTaskRuntime(store=store, executor=executor, clock=lambda: NOW)

    asyncio.run(runtime.handle(task, delivery, "worker-integration"))

    assert [event.stage for event in store.events(task.run_id)] == [1, 2, 3, 4, 5, 6]
    assert store.provider_counts(task.run_id)[:2] == (1, 1)
    assert store.events(task.run_id)[-1].status.value == "complete"
