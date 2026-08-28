"""Deterministic project-profile projection for pathway compatibility."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from audience_take_agents.models import ProjectMedium, ProjectType, SourceAnalysis
from audience_take_agents.publication.errors import SemanticContractError

PROJECT_FORMS = {"feature", "short", "series", "proof_of_concept", "campaign", "unknown"}
PROJECT_LIFECYCLES = {"development", "production", "released", "campaigning", "unknown"}


def project_profile_from_analysis(analysis: SourceAnalysis) -> dict[str, Any]:
    """Project already-evidenced identity into a conservative pathway profile."""
    identity = analysis.identity
    evidence_text = f"{identity.current_format} {identity.medium}".casefold()
    medium = _medium(identity.project_type, evidence_text)
    form = _form(identity.project_type, evidence_text)
    lifecycle = _lifecycle(evidence_text)
    return {
        "medium": medium.value,
        "form": form,
        "lifecycle": lifecycle,
        "sourceIds": list(dict.fromkeys(analysis.source_ids)),
        "qualification": (
            "Profile is conservatively derived from the submitted-source identity: "
            f"projectType={identity.project_type.value}, currentFormat={identity.current_format}, "
            f"medium={identity.medium}."
        ),
    }


def validate_project_profile(
    profile: Mapping[str, Any], *, available_source_ids: set[str]
) -> None:
    """Enforce the strict profile vocabulary and exact source references."""
    if str(profile.get("medium")) not in {item.value for item in ProjectMedium}:
        raise SemanticContractError("project profile has an invalid medium")
    if str(profile.get("form")) not in PROJECT_FORMS:
        raise SemanticContractError("project profile has an invalid form")
    if str(profile.get("lifecycle")) not in PROJECT_LIFECYCLES:
        raise SemanticContractError("project profile has an invalid lifecycle")
    source_ids = [str(item) for item in profile.get("sourceIds", [])]
    if not source_ids or any(source_id not in available_source_ids for source_id in source_ids):
        raise SemanticContractError("project profile must cite exact available source IDs")
    qualification = str(profile.get("qualification", "")).strip()
    if not qualification or len(qualification) > 500:
        raise SemanticContractError("project profile requires a bounded qualification")


def _medium(project_type: ProjectType, text: str) -> ProjectMedium:
    if project_type is ProjectType.DOCUMENTARY:
        return ProjectMedium.DOCUMENTARY
    animation = _has(text, r"\banimat(?:ed|ion)\b", r"\banime\b")
    live_action = _has(text, r"\blive[ -]?action\b")
    if _has(text, r"\bhybrid\b") or (animation and live_action):
        return ProjectMedium.HYBRID
    if animation:
        return ProjectMedium.ANIMATION
    if live_action:
        return ProjectMedium.LIVE_ACTION
    return ProjectMedium.UNKNOWN


def _form(project_type: ProjectType, text: str) -> str:
    if _has(text, r"\bproof[ -]?of[ -]?concept\b", r"\bconcept (?:video|trailer)\b"):
        return "proof_of_concept"
    if _has(text, r"\bcampaign\b", r"\bcrowdfund", r"\bkickstarter\b"):
        return "campaign"
    if project_type is ProjectType.SERIES or _has(text, r"\bseries\b", r"\bepisodic\b"):
        return "series"
    if project_type is ProjectType.SHORT_FILM or _has(text, r"\bshort(?: film)?\b"):
        return "short"
    if project_type in {ProjectType.FILM, ProjectType.DOCUMENTARY} or _has(
        text, r"\bfeature(?:-length)?\b", r"\bfilm\b"
    ):
        return "feature"
    return "unknown"


def _lifecycle(text: str) -> str:
    if _has(text, r"\bcampaign", r"\bcrowdfund", r"\bkickstarter\b"):
        return "campaigning"
    if _has(text, r"\breleased\b", r"\bcompleted\b", r"\bpublished\b", r"\bavailable\b"):
        return "released"
    if _has(text, r"\bin production\b", r"\bfilming\b", r"\banimating\b"):
        return "production"
    if _has(
        text,
        r"\bdevelopment\b",
        r"\bdeveloping\b",
        r"\bproof[ -]?of[ -]?concept\b",
        r"\bconcept (?:video|trailer)\b",
    ):
        return "development"
    return "unknown"


def _has(text: str, *patterns: str) -> bool:
    return any(re.search(pattern, text) is not None for pattern in patterns)
