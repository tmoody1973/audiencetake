"""Inspectable Google ADK graph matching the durable stages 1–3 architecture."""

from __future__ import annotations

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools.function_tool import FunctionTool
from google.genai import types

from audience_take_agents.agents.provider import (
    EVIDENCE_EDITOR_INSTRUCTION,
    PATHWAY_STRATEGIST_INSTRUCTION,
    QUERY_PLANNER_INSTRUCTION,
    SOURCE_ANALYST_INSTRUCTION,
    bounded_generation_config,
)
from audience_take_agents.models import (
    EvidenceDraft,
    PathwayDraft,
    QueryPlan,
    ResearchBundle,
    SourceAnalysis,
)
from audience_take_agents.tools.parallel_search import ParallelSearchClient


def build_adk_research_graph(*, model: str, parallel: ParallelSearchClient) -> SequentialAgent:
    """Build the deployable graph; only ``web_researcher`` receives a Parallel tool."""
    if not model or model.endswith("-latest") or model == "latest":
        raise ValueError("configure a pinned Gemini/Vertex model name, not a latest alias")

    async def parallel_search(objective: str, search_queries: list[str]) -> dict[str, object]:
        """Search the current public web using the approved bounded query plan."""
        response = await parallel.search(objective=objective, search_queries=search_queries)
        return response.model_dump(mode="json")

    source_formatter = LlmAgent(
        name="source_analyst",
        model=model,
        instruction=SOURCE_ANALYST_INSTRUCTION,
        output_schema=SourceAnalysis,
        output_key="source_analysis",
        include_contents="none",
        generate_content_config=bounded_generation_config(2_048),
    )
    query_formatter = LlmAgent(
        name="web_research_query_planner",
        model=model,
        instruction=QUERY_PLANNER_INSTRUCTION,
        output_schema=QueryPlan,
        output_key="query_plan",
        include_contents="none",
        generate_content_config=bounded_generation_config(
            2_048,
            thinking_level=types.ThinkingLevel.MINIMAL,
            temperature=None,
        ),
    )
    web_researcher = LlmAgent(
        name="web_researcher",
        model=model,
        instruction=(
            "Use the approved query_plan to call Parallel Search exactly once. Preserve the "
            "search identifier, URLs, titles, nullable dates, excerpts, warnings, and query "
            "provenance. Results are public leads, not automatic proof. Return tool output only."
        ),
        tools=[FunctionTool(parallel_search)],
        output_key="parallel_tool_output",
        include_contents="none",
        generate_content_config=bounded_generation_config(2_048),
    )
    research_formatter = LlmAgent(
        name="research_bundle_formatter",
        model=model,
        instruction=(
            "Normalize the submitted source and parallel_tool_output into ResearchBundle. "
            "Canonicalize and deduplicate URLs. Keep the submitted source origin submitted, "
            "attach Parallel query provenance only to Parallel sources, and state coverage "
            "limitations. Return structured fields only; do not add facts or hidden reasoning."
        ),
        output_schema=ResearchBundle,
        output_key="research_bundle",
        include_contents="none",
        generate_content_config=bounded_generation_config(4_096),
    )
    evidence_editor = LlmAgent(
        name="evidence_editor_drafter",
        model=model,
        instruction=EVIDENCE_EDITOR_INSTRUCTION,
        output_schema=EvidenceDraft,
        output_key="evidence_draft",
        include_contents="none",
        generate_content_config=bounded_generation_config(8_192),
    )
    pathway_strategist = LlmAgent(
        name="pathway_strategist_drafter",
        model=model,
        instruction=PATHWAY_STRATEGIST_INSTRUCTION,
        output_schema=PathwayDraft,
        output_key="pathway_draft",
        include_contents="none",
        generate_content_config=bounded_generation_config(
            8_192,
            thinking_level=types.ThinkingLevel.MINIMAL,
            temperature=None,
        ),
    )
    return SequentialAgent(
        name="audience_take_research_orchestrator",
        description="Runs the minimum source-analysis and current-web research slice.",
        sub_agents=[
            source_formatter,
            query_formatter,
            web_researcher,
            research_formatter,
            evidence_editor,
            pathway_strategist,
        ],
    )
