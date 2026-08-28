from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from google.adk.events import Event
from google.genai import types
from jsonschema import Draft202012Validator, FormatChecker

from audience_take_agents.agents import provider as provider_module
from audience_take_agents.agents.definitions import build_adk_research_graph
from audience_take_agents.agents.provider import (
    AdkStructuredProvider,
    ModelOutputTruncatedError,
)
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
from audience_take_agents.tools.parallel_search import (
    ParallelSearchClient,
    ParallelSearchError,
    TransportResponse,
)

ROOT = Path(__file__).resolve().parents[3]
NOW = datetime(2026, 8, 26, 17, 0, tzinfo=UTC)


class FakeTransport:
    def __init__(self, responses: list[TransportResponse]) -> None:
        self.responses = responses
        self.calls: list[dict[str, Any]] = []

    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any],
        timeout_seconds: float,
    ) -> TransportResponse:
        self.calls.append(
            {"url": url, "headers": headers, "body": json_body, "timeout": timeout_seconds}
        )
        return self.responses.pop(0)


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
        del run_id, project_id, research_version, nomination, source
        raise AssertionError("not needed")

    async def plan_queries(self, analysis: SourceAnalysis) -> QueryPlan:
        del analysis
        return QueryPlan(
            objective={
                "label": "Verify project context",
                "description": "Verify current creator, project, and comparable context.",
            },
            label="identity, coverage, and comparable context",
            searchQueries=[
                "Junichiro Jackson animation",
                "Junichiro Jackson creator",
                "independent adult animation comparable",
            ],
        )


def analysis() -> SourceAnalysis:
    payload = json.loads((ROOT / "contracts/fixtures/junichiro-source-analysis.json").read_text())
    return SourceAnalysis.model_validate(payload)


def submitted() -> SubmittedSource:
    return SubmittedSource(
        id="source-youtube-trailer",
        url="https://www.youtube.com/watch?v=M2djoKmnOTY",
        canonicalUrl="https://www.youtube.com/watch?v=M2djoKmnOTY",
        title="Junichiro Jackson public project video",
        excerpt="A submitted public project source.",
        publishedAt=None,
        retrievedAt=NOW,
        content="Public page projection.",
    )


def test_parallel_request_is_bounded_and_does_not_expose_key_in_body() -> None:
    transport = FakeTransport(
        [TransportResponse(status_code=200, payload={"search_id": "search-1", "results": []})]
    )
    client = ParallelSearchClient(api_key="server-secret", transport=transport)

    result = asyncio.run(
        client.search(
            objective="Verify current public context.",
            search_queries=["project identity", "creator profile"],
        )
    )

    assert result.search_id == "search-1"
    call = transport.calls[0]
    assert call["body"]["mode"] == "basic"
    assert call["body"]["search_queries"] == ["project identity", "creator profile"]
    assert call["body"]["max_chars_total"] == 12_000
    assert call["body"]["advanced_settings"] == {
        "max_results": 10,
        "excerpt_settings": {"max_chars_per_result": 1_200},
    }
    assert "excerpts" not in call["body"]
    assert "server-secret" not in json.dumps(call["body"])
    assert call["headers"]["x-api-key"] == "server-secret"
    with pytest.raises(ValueError, match="two or three"):
        asyncio.run(client.search(objective="Verify.", search_queries=["one query"]))
    with pytest.raises(ValueError, match="unique"):
        asyncio.run(client.search(objective="Verify.", search_queries=["same", "same"]))

    with pytest.raises(ValueError, match="diverse"):
        QueryPlan(
            objective={"label": "Verify", "description": "Verify current context."},
            label="too similar",
            searchQueries=["project creator profile", "creator project profile"],
        )


def test_parallel_retries_only_retryable_statuses_and_missing_key_is_typed() -> None:
    transport = FakeTransport(
        [
            TransportResponse(status_code=429, payload={}),
            TransportResponse(status_code=503, payload={}),
            TransportResponse(status_code=200, payload={"search_id": "ok", "results": []}),
        ]
    )
    delays: list[float] = []

    async def no_sleep(delay: float) -> None:
        delays.append(delay)

    client = ParallelSearchClient(
        api_key="key", transport=transport, sleep=no_sleep, max_attempts=3
    )
    assert asyncio.run(
        client.search(objective="Verify.", search_queries=["project identity", "creator profile"])
    ).search_id == "ok"
    assert len(transport.calls) == 3
    assert len(delays) == 2

    no_key = ParallelSearchClient(api_key=None, transport=FakeTransport([]))
    with pytest.raises(ParallelSearchError) as missing:
        asyncio.run(
            no_key.search(
                objective="Verify.",
                search_queries=["project identity", "creator profile"],
            )
        )
    assert missing.value.retryable is True

    rejected = ParallelSearchClient(
        api_key="key",
        transport=FakeTransport([TransportResponse(status_code=400, payload={})]),
    )
    with pytest.raises(ParallelSearchError) as invalid:
        asyncio.run(
            rejected.search(
                objective="Verify.",
                search_queries=["project identity", "creator profile"],
            )
        )
    assert invalid.value.retryable is False


def test_web_researcher_normalizes_deduplicates_and_preserves_provenance() -> None:
    transport = FakeTransport(
        [
            TransportResponse(
                status_code=200,
                payload={
                    "search_id": "search-42",
                    "warnings": None,
                    "results": [
                        {
                            "url": "https://example.com/story?utm_source=parallel&id=7",
                            "title": "Project profile",
                            "publish_date": "2026-08-20T12:00:00Z",
                            "excerpts": ["A relevant public excerpt."],
                        },
                        {
                            "url": "https://example.com/story?id=7",
                            "title": "Duplicate profile",
                            "publish_date": None,
                            "excerpts": ["Duplicate."],
                        },
                        {
                            "url": "https://www.youtube.com/watch?v=M2djoKmnOTY",
                            "title": "Submitted result rediscovered",
                            "publish_date": None,
                            "excerpts": ["Must remain submitted."],
                        },
                    ],
                },
            )
        ]
    )
    client = ParallelSearchClient(api_key="key", transport=transport)
    researcher = WebResearcher(
        model_provider=FakeModelProvider(),
        parallel=client,
        clock=lambda: NOW,
    )

    bundle = asyncio.run(researcher.research(analysis=analysis(), submitted=submitted()))

    assert len(bundle.sources) == 2
    submitted_result = next(source for source in bundle.sources if source.origin == "submitted")
    parallel_result = next(source for source in bundle.sources if source.origin == "parallel")
    assert submitted_result.query_provenance is None
    assert str(parallel_result.canonical_url) == "https://example.com/story?id=7"
    assert parallel_result.query_provenance is not None
    assert parallel_result.query_provenance.query_batch_id == "parallel-search-42"
    assert bundle.tool_receipts[0].result_count == 1

    schema = json.loads((ROOT / "contracts/schemas/research-bundle.schema.json").read_text())
    errors = list(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(
            bundle.model_dump(by_alias=True, mode="json")
        )
    )
    assert errors == []


def test_only_web_researcher_has_the_single_parallel_tool() -> None:
    graph = build_adk_research_graph(
        model="gemini-2.5-flash",
        parallel=ParallelSearchClient(api_key="key", transport=FakeTransport([])),
    )
    agents = {agent.name: agent for agent in graph.sub_agents}

    tool_owners = {
        name: [tool.name for tool in agent.tools]
        for name, agent in agents.items()
        if agent.tools
    }
    assert tool_owners == {"web_researcher": ["parallel_search"]}
    assert [tool.name for tool in agents["web_researcher"].tools] == ["parallel_search"]
    assert agents["web_researcher"].output_schema is None
    assert agents["research_bundle_formatter"].output_schema is ResearchBundle
    assert agents["web_researcher"].generate_content_config.max_output_tokens == 2_048
    assert agents["evidence_editor_drafter"].generate_content_config.max_output_tokens == 8_192
    assert agents["pathway_strategist_drafter"].generate_content_config.max_output_tokens == 8_192
    assert agents["pathway_strategist_drafter"].generate_content_config.thinking_config == (
        types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    )
    query_planner = agents["web_research_query_planner"].generate_content_config
    assert query_planner.max_output_tokens == 2_048
    assert query_planner.thinking_config == types.ThinkingConfig(
        thinking_level=types.ThinkingLevel.MINIMAL
    )
    assert query_planner.temperature is None
    assert "scout_card_drafter" not in agents


def test_structured_provider_budgets_evidence_without_unbounding_other_stages() -> None:
    provider = AdkStructuredProvider(model="gemini-2.5-flash")

    assert provider.source_analyst.generate_content_config.max_output_tokens == 4_096
    assert provider.query_planner.generate_content_config.max_output_tokens == 2_048
    assert provider.query_planner.generate_content_config.thinking_config == (
        types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    )
    assert provider.query_planner.generate_content_config.temperature is None
    assert provider.evidence_editor.generate_content_config.max_output_tokens == 8_192
    assert provider.pathway_strategist.generate_content_config.max_output_tokens == 8_192
    assert provider.pathway_strategist.generate_content_config.thinking_config == (
        types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    )
    assert not hasattr(provider, "card_assembler")
    # These agents return events directly to the provider. Avoid ADK's temporary
    # session-state validation so our boundary can report safe Pydantic locations.
    assert all(
        agent.output_key is None
        for agent in (
            provider.source_analyst,
            provider.query_planner,
            provider.evidence_editor,
            provider.pathway_strategist,
        )
    )


def _pathway_draft_json() -> str:
    content = {
        "label": "Serialized animation development",
        "format": "Serialized adult animation",
        "strategyKind": "development",
        "proposedMedium": "animation",
        "crossFormat": False,
        "crossFormatClaimIds": [],
        "audience": "Adult animation viewers.",
        "rationale": "Test one bounded direction against qualified public evidence.",
        "supportingClaimIds": ["claim-qualified"],
        "comparableSourceIds": ["source-public"],
        "strengths": ["The format supports recurring character arcs."],
        "risks": ["Audience demand has not been measured."],
        "openQuestions": ["Which format best fits the intended audience?"],
        "confidence": "low",
        "nextExperiment": {
            "title": "Test two concepts",
            "hypothesis": "One premise will prompt more qualified interest.",
            "method": "Show two short concepts to a bounded participant sample.",
            "participantAction": "Select one concept and explain the choice.",
            "signal": "Preference rate and recurring reasons.",
            "timebox": "Two weeks",
        },
    }
    return PathwayDraft(
        pathways=[
            content,
            {
                **content,
                "label": "Independent animation financing",
                "format": "Feature-length independent animation",
                "strategyKind": "financing",
                "audience": "Independent animation audiences.",
            },
            {
                **content,
                "label": "Creator-direct animation audience",
                "format": "Short-form animation publishing",
                "strategyKind": "audience",
                "audience": "Creator-direct serial audiences.",
            },
        ]
    ).model_dump_json(by_alias=True)


def _run_structured_provider_with_events(
    monkeypatch: pytest.MonkeyPatch, events: list[Event]
) -> PathwayDraft:
    class FakeRunner:
        def __init__(self, **_: object) -> None:
            pass

        async def run_async(self, **_: object):  # type: ignore[no-untyped-def]
            for event in events:
                yield event

    monkeypatch.setattr(provider_module, "Runner", FakeRunner)
    provider = AdkStructuredProvider(model="gemini-2.5-flash")
    return asyncio.run(
        provider._run(
            provider.pathway_strategist,
            session_id="run-pathways-v1",
            user_id="project-1",
            request={"evidenceLedger": {}, "sources": []},
            output_type=PathwayDraft,
        )
    )


def test_structured_provider_uses_only_the_final_agent_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = AdkStructuredProvider(model="gemini-2.5-flash")
    valid_json = _pathway_draft_json()
    events = [
        Event(
            author=provider.pathway_strategist.name,
            partial=True,
            content=types.Content(
                role="model", parts=[types.Part.from_text(text="partial-not-json")]
            ),
        ),
        Event(
            author=provider.pathway_strategist.name,
            finish_reason=types.FinishReason.STOP,
            content=types.Content(
                role="model", parts=[types.Part.from_text(text=valid_json)]
            ),
        ),
        Event(
            author="framework",
            content=types.Content(
                role="model", parts=[types.Part.from_text(text="trailing-not-json")]
            ),
        ),
    ]

    result = _run_structured_provider_with_events(monkeypatch, events)

    assert result.model_dump_json(by_alias=True) == valid_json


def test_structured_provider_classifies_max_token_json_before_validation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = AdkStructuredProvider(model="gemini-2.5-flash")
    truncated = _pathway_draft_json()[:200]
    events = [
        Event(
            author=provider.pathway_strategist.name,
            finish_reason=types.FinishReason.MAX_TOKENS,
            content=types.Content(
                role="model", parts=[types.Part.from_text(text=truncated)]
            ),
        )
    ]

    with pytest.raises(ModelOutputTruncatedError):
        _run_structured_provider_with_events(monkeypatch, events)


def test_evidence_draft_schema_rejects_loose_or_unbounded_claims() -> None:
    with pytest.raises(ValueError):
        EvidenceDraft.model_validate(
            {
                "claims": [{}],
                "comparables": [],
                "externalSignals": [],
                "limitations": ["Public-web evidence is incomplete."],
                "unresolvedQuestions": ["Who controls the screen rights?"],
            }
        )

    for invalid_claim in (
        {
            "id": "claim-supported",
            "statement": "A claim with an unavailable strength.",
            "status": "supported",
            "sourceIds": ["source-1"],
            "qualification": "The source is not independently verified.",
        },
        {
            "id": "claim-no-source",
            "statement": "A claim without a source.",
            "status": "inference",
            "sourceIds": [],
            "qualification": "This inference still needs a cited basis.",
        },
        {
            "id": "claim-no-qualification",
            "statement": "A claim without its limitation.",
            "status": "qualified",
            "sourceIds": ["source-1"],
        },
    ):
        with pytest.raises(ValueError):
            EvidenceDraft.model_validate(
                {
                    "claims": [invalid_claim],
                    "comparables": [],
                    "externalSignals": [],
                    "limitations": ["Public-web evidence is incomplete."],
                    "unresolvedQuestions": ["Who controls the screen rights?"],
                }
            )

    with pytest.raises(ValueError):
        EvidenceDraft.model_validate(
            {
                "claims": [
                    {
                        "id": f"claim-{index}",
                        "statement": "A bounded claim.",
                        "status": "qualified",
                        "sourceIds": ["source-1"],
                        "qualification": "Requires verification.",
                    }
                    for index in range(7)
                ],
                "comparables": [],
                "externalSignals": [],
                "limitations": ["Public-web evidence is incomplete."],
                "unresolvedQuestions": ["Who controls the screen rights?"],
            }
        )


def test_external_signal_uses_vertex_compatible_boolean_and_rejects_true() -> None:
    schema = EvidenceDraft.model_json_schema(by_alias=True)
    native_count_schema = schema["$defs"]["ExternalSignalDraft"]["properties"][
        "nativeAudienceCount"
    ]
    assert native_count_schema["type"] == "boolean"
    assert "const" not in native_count_schema
    assert "enum" not in native_count_schema

    with pytest.raises(ValueError, match="cannot be native audience counts"):
        EvidenceDraft.model_validate(
            {
                "claims": [
                    {
                        "id": "claim-1",
                        "statement": "A bounded claim.",
                        "status": "qualified",
                        "sourceIds": ["source-1"],
                        "qualification": "Requires verification.",
                    }
                ],
                "comparables": [],
                "externalSignals": [
                    {
                        "id": "signal-1",
                        "label": "External discussion",
                        "analysis": "Public commentary is mixed.",
                        "sourceIds": ["source-1"],
                        "limitations": ["The sample is incomplete."],
                        "nativeAudienceCount": True,
                    }
                ],
                "limitations": ["Public-web evidence is incomplete."],
                "unresolvedQuestions": ["Who controls the screen rights?"],
            }
        )


def test_pathway_draft_is_bounded_and_injects_fixed_identity() -> None:
    schema = PathwayDraft.model_json_schema(by_alias=True)
    assert set(schema["properties"]) == {"pathways"}
    assert schema["properties"]["pathways"]["minItems"] == 3
    assert schema["properties"]["pathways"]["maxItems"] == 3
    content_schema = schema["$defs"]["PathwayDirectionDraft"]
    assert content_schema["properties"]["label"]["maxLength"] == 160
    assert content_schema["properties"]["format"]["maxLength"] == 160
    assert content_schema["properties"]["audience"]["maxLength"] == 240
    assert content_schema["properties"]["rationale"]["maxLength"] == 600
    assert content_schema["properties"]["supportingClaimIds"]["maxItems"] == 3
    assert content_schema["properties"]["comparableSourceIds"]["maxItems"] == 2
    assert content_schema["properties"]["strengths"]["maxItems"] == 2
    assert content_schema["properties"]["risks"]["maxItems"] == 2
    assert content_schema["properties"]["openQuestions"]["maxItems"] == 2

    content = {
        "label": "Serialized animation development",
        "format": "Serialized adult animation",
        "strategyKind": "development",
        "proposedMedium": "animation",
        "crossFormat": False,
        "crossFormatClaimIds": [],
        "audience": "Adult animation viewers seeking serialized character drama.",
        "rationale": "Test a bounded direction against the qualified public evidence.",
        "supportingClaimIds": ["claim-qualified"],
        "comparableSourceIds": ["source-public"],
        "strengths": ["The format supports recurring character arcs."],
        "risks": ["Audience demand has not been measured."],
        "openQuestions": ["Which episode length best fits the intended audience?"],
        "confidence": "low",
        "nextExperiment": {
            "title": "Test two concise concepts",
            "hypothesis": "One serialized premise will prompt more qualified interest.",
            "method": "Show two short concept descriptions to a bounded participant sample.",
            "participantAction": "Select one concept and explain the choice.",
            "signal": "Preference rate and recurring reasons for selection.",
            "timebox": "Two weeks",
        },
    }
    draft = PathwayDraft(
        pathways=[
            content,
            {
                **content,
                "label": "Independent animation financing",
                "format": "Feature-length independent animation",
                "strategyKind": "financing",
                "audience": "Independent animation feature audiences.",
            },
            {
                **content,
                "label": "Creator-direct animation audience",
                "format": "Short-form animation publishing",
                "strategyKind": "audience",
                "audience": "Creator-direct serial audiences.",
            },
        ]
    )

    pathways = draft.to_pathways(run_id="run-1", project_id="project-1")
    assert [pathway["id"] for pathway in pathways] == [
        "pathway-01",
        "pathway-02",
        "pathway-03",
    ]
    assert [pathway["order"] for pathway in pathways] == [1, 2, 3]
    assert [pathway["label"] for pathway in pathways] == [
        "Serialized animation development",
        "Independent animation financing",
        "Creator-direct animation audience",
    ]
    assert all(pathway["runId"] == "run-1" for pathway in pathways)
    assert all(pathway["projectId"] == "project-1" for pathway in pathways)

    with pytest.raises(ValueError):
        PathwayDraft(
            pathways=[
                {**content, "supportingClaimIds": []},
                content,
                content,
            ]
        )
