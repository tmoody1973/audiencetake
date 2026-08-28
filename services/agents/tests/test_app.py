from pytest import MonkeyPatch

from audience_take_agents.app import AgentSettings, service_identity


def test_service_identity_is_stable() -> None:
    identity = service_identity()

    assert identity.name == "audience-take-agents"
    assert identity.version == "0.1.0"


def test_default_provider_configuration_is_current_and_regional(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("AUDIENCE_TAKE_GEMINI_MODEL", raising=False)
    monkeypatch.delenv("AUDIENCE_TAKE_TRAILER_CRITIC_MODEL", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_LOCATION", raising=False)

    settings = AgentSettings.from_environment()

    assert settings.model == "gemini-3.5-flash"
    assert settings.trailer_critic_model == "gemini-3.7-flash"
    assert settings.location == "us"
