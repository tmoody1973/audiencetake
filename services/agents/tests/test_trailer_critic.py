from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from google.genai import types
from pydantic import ValidationError

from audience_take_agents.models import TrailerCriticDraft
from audience_take_agents.trailer_critic import (
    GeminiTrailerCriticProvider,
    TrailerCriticInputError,
    TrailerCriticService,
    trailer_analysis_id,
)

NOW = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
VIDEO_ID = "s8G7425lfKs"
VIDEO_URL = f"https://www.youtube.com/watch?v={VIDEO_ID}"


def draft_payload() -> dict[str, Any]:
    return {
        "structuralNarrative": {
            "genreSignaling": "The trailer signals an urban supernatural action story.",
            "narrativeDelivery": "A compact vignette prioritizes tone over plot summary.",
            "trailerType": "Proof-of-concept trailer.",
            "beats": [
                {
                    "label": "Hook",
                    "start": "00:00",
                    "end": "00:30",
                    "observation": "A reflective audiovisual opening establishes mood.",
                    "modality": "audiovisual",
                },
                {
                    "label": "Turn",
                    "start": "00:31",
                    "end": "01:00",
                    "observation": "The pace shifts into action-oriented staging.",
                    "modality": "visual",
                },
            ],
        },
        "technicalCraft": {
            "editingAndPace": "The edit uses contrast between measured and rapid passages.",
            "cinematographyAndFraming": "Low angles and close framing emphasize tension.",
            "soundAndScore": "Music and impacts organize the trailer's rhythmic escalation.",
            "graphicsAndTitles": "The title reveal functions as the closing brand signature.",
        },
        "marketingPersuasion": {
            "uniqueSellingProposition": "The critic hypothesis is a distinctive genre blend.",
            "targetAudienceHypothesis": "It may appeal to adult animation and urban fantasy viewers.",
            "conceptVsStarEmphasis": "The pitch emphasizes concept and style rather than cast.",
            "representationCaveat": "The trailer cannot establish full-project consistency.",
        },
        "emotionalRhetorical": {
            "emotionalHook": "The opening invites curiosity before kinetic escalation.",
            "toneAndMoodBalance": "Dark action is balanced by grounded humor.",
            "persuasiveArgument": "Execution and chemistry make the case for further development.",
        },
        "matrix": [
            {"category": "genre", "analysis": "Occult urban action."},
            {"category": "narrative_stance", "analysis": "A tonal micro-vignette."},
            {"category": "usp", "analysis": "A hybrid visual and cultural vocabulary."},
            {"category": "target_audience", "analysis": "A critic hypothesis, not a measurement."},
            {"category": "sound_music", "analysis": "Rhythmic contrast shapes escalation."},
            {"category": "camera_editing", "analysis": "Close framing shifts into rapid montage."},
        ],
        "sourceIds": ["source-video"],
        "limitations": ["The video is sampled rather than inspected frame by frame."],
    }


class FakeModels:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def generate_content(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
            text=TrailerCriticDraft.model_validate(draft_payload()).model_dump_json(
                by_alias=True
            ),
        )


class FakeClient:
    def __init__(self) -> None:
        self.models = FakeModels()
        self.aio = SimpleNamespace(models=self.models)


class FakeStore:
    def __init__(self) -> None:
        self.existing: dict[str, Any] | None = None
        self.commits: list[dict[str, Any]] = []

    def load_existing(self, artifact_id: str) -> dict[str, Any] | None:
        assert artifact_id == trailer_analysis_id("project-1", VIDEO_ID, 1)
        return self.existing

    def load_public_context(
        self, *, project_id: str, source_id: str, youtube_url: str
    ) -> dict[str, object]:
        assert (project_id, source_id, youtube_url) == (
            "project-1",
            "source-video",
            VIDEO_URL,
        )
        return {
            "cardVersionId": "card-v1",
            "title": "Junichiro Jackson",
            "allowedSourceIds": ["source-video"],
        }

    def commit(self, artifact: dict[str, Any]) -> bool:
        self.commits.append(artifact)
        self.existing = artifact
        return True


def test_trailer_contract_rejects_bad_matrix_order_and_descending_timestamps() -> None:
    bad_time = draft_payload()
    bad_time["structuralNarrative"]["beats"][0]["start"] = "00:40"
    bad_time["structuralNarrative"]["beats"][0]["end"] = "00:30"
    with pytest.raises(ValidationError, match="must not precede"):
        TrailerCriticDraft.model_validate(bad_time)

    bad_matrix = draft_payload()
    bad_matrix["matrix"] = list(reversed(bad_matrix["matrix"]))
    with pytest.raises(ValidationError, match="six ordered categories"):
        TrailerCriticDraft.model_validate(bad_matrix)


def test_vertex_request_uses_video_first_and_separate_pinned_model() -> None:
    client = FakeClient()
    provider = GeminiTrailerCriticProvider(
        model="gemini-3.7-flash",
        project="test-project",
        client=client,
    )

    result = asyncio.run(
        provider.analyze(
            project_id="project-1",
            source_id="source-video",
            youtube_url=VIDEO_URL,
            public_context={"allowedSourceIds": ["source-video"]},
        )
    )

    assert result.matrix[0].category == "genre"
    call = client.models.calls[0]
    assert call["model"] == "gemini-3.7-flash"
    assert call["contents"][0].file_data.file_uri == VIDEO_URL
    assert call["contents"][1].text
    config = call["config"]
    assert config.max_output_tokens == 8_192
    assert config.temperature is None
    assert config.thinking_config == types.ThinkingConfig(
        thinking_level=types.ThinkingLevel.MEDIUM
    )
    assert config.response_schema is TrailerCriticDraft


def test_service_publishes_once_and_injects_sampling_boundaries() -> None:
    client = FakeClient()
    provider = GeminiTrailerCriticProvider(
        model="gemini-3.7-flash",
        project="test-project",
        client=client,
    )
    store = FakeStore()
    service = TrailerCriticService(provider=provider, store=store, clock=lambda: NOW)

    first = asyncio.run(
        service.analyze_and_publish(
            project_id="project-1",
            source_id="source-video",
            youtube_url=VIDEO_URL,
        )
    )
    replay = asyncio.run(
        service.analyze_and_publish(
            project_id="project-1",
            source_id="source-video",
            youtube_url=VIDEO_URL,
        )
    )

    assert first == replay
    assert len(client.models.calls) == 1
    assert len(store.commits) == 1
    assert first["visibility"] == "public"
    assert first["modelId"] == "gemini-3.7-flash"
    assert any("frame-perfect" in item for item in first["limitations"])
    assert any("Rapid cuts" in item for item in first["limitations"])


def test_service_rejects_noncanonical_or_unknown_source_citations() -> None:
    client = FakeClient()
    provider = GeminiTrailerCriticProvider(
        model="gemini-3.7-flash", project="test-project", client=client
    )
    service = TrailerCriticService(provider=provider, store=FakeStore(), clock=lambda: NOW)
    with pytest.raises(TrailerCriticInputError):
        asyncio.run(
            service.analyze_and_publish(
                project_id="project-1",
                source_id="source-video",
                youtube_url="https://example.com/video",
            )
        )
