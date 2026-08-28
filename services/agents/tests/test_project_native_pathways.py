from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from audience_take_agents.models import SourceAnalysis
from audience_take_agents.publication import PathwayStrategist, SemanticContractError
from audience_take_agents.publication.project_profile import project_profile_from_analysis

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "contracts" / "fixtures"


def fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def pathway_set(medium: str) -> list[dict[str, Any]]:
    source = fixture("junichiro-source.json")
    base = fixture("junichiro-pathway.json")
    descriptors = {
        "documentary": [
            ("Festival documentary expansion", "Feature documentary exhibition"),
            ("Documentary distribution campaign", "Feature documentary distribution"),
            ("Documentary education licensing", "Documentary educational exhibition"),
        ],
        "animation": [
            ("Serialized animation development", "Serialized adult animation"),
            ("Independent animation financing", "Feature-length independent animation"),
            ("Creator-direct animation audience", "Short-form animation publishing"),
        ],
        "live_action": [
            ("Live-action package development", "Feature live-action package"),
            ("Live-action distribution campaign", "Feature live-action distribution"),
            ("Live-action audience discovery", "Live-action audience preview"),
        ],
        "unknown": [
            ("Project package validation", "Existing-format development package"),
            ("Distribution route discovery", "Existing-format distribution test"),
            ("Audience premise discovery", "Existing-format audience preview"),
        ],
    }[medium]
    strategies = ["development", "distribution", "audience"]
    pathways: list[dict[str, Any]] = []
    for index, ((label, format_name), strategy) in enumerate(
        zip(descriptors, strategies, strict=True), start=1
    ):
        pathway = deepcopy(base)
        pathway.update(
            id=f"pathway-{index:02d}",
            order=index,
            label=label,
            format=format_name,
            strategyKind=strategy,
            proposedMedium=medium,
            crossFormat=False,
            crossFormatClaimIds=[],
        )
        pathways.append(pathway)
    assert source["id"] == "source-youtube-trailer"
    return pathways


def ledger_for(medium: str) -> dict[str, Any]:
    ledger = fixture("junichiro-evidence-ledger.json")
    ledger["projectProfile"] = {
        "medium": medium,
        "form": "feature" if medium == "documentary" else "unknown",
        "lifecycle": "unknown",
        "sourceIds": ["source-youtube-trailer"],
        "qualification": "The submitted public source establishes this conservative profile.",
    }
    return ledger


@pytest.mark.parametrize("medium", ["documentary", "animation", "live_action", "unknown"])
def test_project_native_pathways_accept_exactly_three_media_compatible_directions(
    medium: str,
) -> None:
    source = fixture("junichiro-source.json")
    validated = PathwayStrategist().validate(
        pathway_set(medium),
        evidence_ledger=ledger_for(medium),
        sources=[source],
    )
    assert len(validated) == 3
    assert {pathway["proposedMedium"] for pathway in validated} == {medium}


def test_documentary_profile_rejects_animation_label_even_when_declared_documentary() -> None:
    pathways = pathway_set("documentary")
    pathways[0]["label"] = "Premium adult animated series"
    with pytest.raises(SemanticContractError, match="contradicts proposed medium"):
        PathwayStrategist().validate(
            pathways,
            evidence_ledger=ledger_for("documentary"),
            sources=[fixture("junichiro-source.json")],
        )


def test_cross_format_requires_exact_qualified_claim_and_adaptation_strategy() -> None:
    pathways = pathway_set("documentary")
    pathways[0].update(
        label="Animated adaptation development",
        format="Feature animation adaptation",
        strategyKind="adaptation",
        proposedMedium="animation",
        crossFormat=True,
        crossFormatClaimIds=[],
    )
    ledger = ledger_for("documentary")
    source = fixture("junichiro-source.json")
    with pytest.raises(SemanticContractError, match="requires qualified evidence"):
        PathwayStrategist().validate(pathways, evidence_ledger=ledger, sources=[source])

    pathways[0]["crossFormatClaimIds"] = ["claim-project-world"]
    ledger["claims"][0]["status"] = "inference"
    with pytest.raises(SemanticContractError, match="requires qualified evidence"):
        PathwayStrategist().validate(pathways, evidence_ledger=ledger, sources=[source])

    ledger["claims"][0]["status"] = "qualified"
    validated = PathwayStrategist().validate(
        pathways, evidence_ledger=ledger, sources=[source]
    )
    assert validated[0]["crossFormat"] is True


def test_project_profile_derivation_is_conservative_for_known_and_unknown_media() -> None:
    analysis_payload = fixture("junichiro-source-analysis.json")
    animation = project_profile_from_analysis(SourceAnalysis.model_validate(analysis_payload))
    assert animation == {
        "medium": "animation",
        "form": "proof_of_concept",
        "lifecycle": "development",
        "sourceIds": ["source-youtube-trailer"],
        "qualification": (
            "Profile is conservatively derived from the submitted-source identity: "
            "projectType=series, currentFormat=Public concept video submitted for scouting, "
            "medium=animation."
        ),
    }

    analysis_payload["identity"].update(
        projectType="creator_project",
        currentFormat="Public project page",
        medium="Not established",
    )
    unknown = project_profile_from_analysis(SourceAnalysis.model_validate(analysis_payload))
    assert unknown["medium"] == "unknown"
    assert unknown["form"] == "unknown"
    assert unknown["lifecycle"] == "unknown"
