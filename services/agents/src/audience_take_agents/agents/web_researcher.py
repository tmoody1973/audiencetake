"""Web Researcher: the only owner of the Parallel Search capability."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from audience_take_agents.agents.provider import ResearchModelProvider
from audience_take_agents.models import (
    QueryBatch,
    QueryProvenance,
    ResearchBundle,
    ResearchSource,
    SourceAnalysis,
    SourceOrigin,
    SubmittedSource,
    ToolReceipt,
)
from audience_take_agents.tools.parallel_search import ParallelSearchClient
from audience_take_agents.tools.source_reader import canonicalize_public_url


class Clock(Protocol):
    def __call__(self) -> datetime: ...


def utc_now() -> datetime:
    return datetime.now(UTC)


class WebResearcher:
    """Plans and performs one bounded search batch, then normalizes its evidence leads."""

    def __init__(
        self,
        *,
        model_provider: ResearchModelProvider,
        parallel: ParallelSearchClient,
        clock: Clock = utc_now,
    ) -> None:
        self._model_provider = model_provider
        self._parallel = parallel
        self._clock = clock

    async def research(
        self,
        *,
        analysis: SourceAnalysis,
        submitted: SubmittedSource,
    ) -> ResearchBundle:
        plan = await self._model_provider.plan_queries(analysis)
        response = await self._parallel.search(
            objective=plan.objective.description,
            search_queries=plan.search_queries,
        )
        batch_id = f"parallel-{response.search_id}"
        provenance = QueryProvenance(
            provider="parallel",
            queryBatchId=batch_id,
            queryLabel=plan.label,
        )
        retrieved_at = self._clock()
        submitted_source = ResearchSource(
            id=submitted.id,
            origin=SourceOrigin.SUBMITTED,
            url=submitted.url,
            canonicalUrl=submitted.canonical_url,
            title=submitted.title,
            excerpt=submitted.excerpt,
            publishedAt=submitted.published_at,
            retrievedAt=submitted.retrieved_at,
            queryProvenance=None,
        )
        normalized: dict[str, ResearchSource] = {
            str(submitted_source.canonical_url): submitted_source
        }
        parallel_ids: list[str] = []
        for result in response.results:
            try:
                canonical_url = canonicalize_result_url(result.url)
            except ValueError:
                continue
            if canonical_url in normalized:
                # A submitted source keeps submitted provenance even if Parallel also returns it.
                continue
            excerpt = " ".join(part.strip() for part in result.excerpts if part.strip())[:2000]
            if not excerpt or not result.title.strip():
                continue
            source_id = stable_source_id(canonical_url)
            try:
                published_at = parse_publish_date(result.publish_date)
                source = ResearchSource.model_validate(
                    {
                        "id": source_id,
                        "origin": SourceOrigin.PARALLEL,
                        "url": result.url,
                        "canonicalUrl": canonical_url,
                        "title": result.title.strip()[:500],
                        "excerpt": excerpt,
                        "publishedAt": published_at,
                        "retrievedAt": retrieved_at,
                        "queryProvenance": provenance,
                    }
                )
            except ValueError:
                continue
            normalized[canonical_url] = source
            parallel_ids.append(source_id)
        batch = QueryBatch(
            id=batch_id,
            provider="parallel",
            label=plan.label,
            searchQueries=plan.search_queries,
            sourceIds=parallel_ids,
        )
        receipt = ToolReceipt(
            toolName="Parallel Search",
            queryBatchId=batch_id,
            queryLabel=plan.label,
            resultCount=len(parallel_ids),
            sourceIds=parallel_ids,
        )
        limitations = [
            "Parallel results are public-web leads and require evidence qualification.",
            (
                "This search does not establish complete comments, private analytics, private "
                "campaign records, authenticated platform data, or industry interest."
            ),
        ]
        if response.warnings:
            limitations.append("Parallel returned a provider warning; coverage may be incomplete.")
        if not parallel_ids:
            limitations.append("The bounded search returned no usable new public sources.")
        return ResearchBundle(
            runId=analysis.run_id,
            projectId=analysis.project_id,
            researchVersion=analysis.research_version,
            objective=plan.objective,
            queryBatches=[batch],
            sources=list(normalized.values()),
            toolReceipts=[receipt],
            limitations=limitations,
        )


def canonicalize_result_url(url: str) -> str:
    canonical = canonicalize_public_url(url)
    parsed = urlsplit(canonical)
    query = urlencode(
        sorted(
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.lower().startswith("utm_") and key.lower() not in {"fbclid", "gclid"}
        )
    )
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))


def stable_source_id(canonical_url: str) -> str:
    digest = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()[:16]
    return f"source-parallel-{digest}"


def parse_publish_date(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError("invalid Parallel publish date") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed
