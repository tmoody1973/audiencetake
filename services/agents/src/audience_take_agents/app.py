"""Cloud Run entrypoint placeholder for the Audience Take ADK orchestrator."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceIdentity:
    name: str = "audience-take-agents"
    version: str = "0.1.0"


def service_identity() -> ServiceIdentity:
    """Return non-secret service metadata for health checks."""
    return ServiceIdentity()
