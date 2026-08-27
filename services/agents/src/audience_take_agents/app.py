"""Cloud Run service identity and configured ADK executor factory."""

import os
from dataclasses import dataclass
from typing import Any

from audience_take_agents.agents.definitions import build_adk_research_graph
from audience_take_agents.agents.provider import AdkStructuredProvider
from audience_take_agents.agents.web_researcher import WebResearcher
from audience_take_agents.orchestrator import AudienceTakeOrchestrator, FirestoreInputLoader
from audience_take_agents.publication import ScoutCardPublisher
from audience_take_agents.publication.store import PublicationStore
from audience_take_agents.tools.firestore_publication import FirestorePublicationStore
from audience_take_agents.tools.parallel_search import ParallelSearchClient
from audience_take_agents.tools.source_reader import SafeSourceReader


@dataclass(frozen=True)
class ServiceIdentity:
    name: str = "audience-take-agents"
    version: str = "0.1.0"


def service_identity() -> ServiceIdentity:
    """Return non-secret service metadata for health checks."""
    return ServiceIdentity()


@dataclass(frozen=True)
class AgentSettings:
    """Non-secret runtime configuration; the Parallel key remains server-only."""

    model: str
    location: str
    parallel_api_key: str | None

    @classmethod
    def from_environment(cls) -> "AgentSettings":
        model = os.environ.get("AUDIENCE_TAKE_GEMINI_MODEL", "gemini-3.5-flash")
        if model.endswith("-latest") or model == "latest":
            raise ValueError("AUDIENCE_TAKE_GEMINI_MODEL cannot use a moving latest alias")
        return cls(
            model=model,
            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us"),
            parallel_api_key=os.environ.get("PARALLEL_API_KEY"),
        )


def create_research_executor(
    firestore_client: Any,
    *,
    settings: AgentSettings | None = None,
    publication_store: PublicationStore | None = None,
) -> AudienceTakeOrchestrator:
    """Create the production executor with Secret Manager-injected environment config."""
    configured = settings or AgentSettings.from_environment()
    # ADK/Vertex reads GOOGLE_CLOUD_LOCATION; retaining the value here also makes
    # location selection explicit and testable without logging any credentials.
    os.environ.setdefault("GOOGLE_CLOUD_LOCATION", configured.location)
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
    provider = AdkStructuredProvider(model=configured.model)
    parallel = ParallelSearchClient(api_key=configured.parallel_api_key)
    researcher = WebResearcher(
        model_provider=provider,
        parallel=parallel,
    )
    # Construct the official SequentialAgent graph at startup so invalid model/
    # tool wiring fails before a task is leased. Durable execution is controlled
    # by AudienceTakeOrchestrator and its Firestore stage boundaries.
    graph = build_adk_research_graph(model=configured.model, parallel=parallel)
    publisher = ScoutCardPublisher(publication_store or FirestorePublicationStore(firestore_client))
    return AudienceTakeOrchestrator(
        input_loader=FirestoreInputLoader(firestore_client),
        source_reader=SafeSourceReader(),
        model_provider=provider,
        web_researcher=researcher,
        publisher=publisher,
        adk_graph=graph,
    )
