from audience_take_agents.app import service_identity


def test_service_identity_is_stable() -> None:
    identity = service_identity()

    assert identity.name == "audience-take-agents"
    assert identity.version == "0.1.0"
