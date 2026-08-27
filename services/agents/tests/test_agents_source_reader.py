from __future__ import annotations

import socket
from email.message import Message
from typing import Any

import pytest

from audience_take_agents.tools.source_reader import (
    HttpResponse,
    SafeSourceReader,
    SourceReadError,
    UnsafeSourceError,
    UrllibSourceTransport,
    assert_public_host,
    canonicalize_public_url,
)


class FakeSourceTransport:
    def __init__(self, response: HttpResponse) -> None:
        self.response = response
        self.calls: list[tuple[str, int, float]] = []

    def get(self, url: str, *, max_bytes: int, timeout_seconds: float) -> HttpResponse:
        self.calls.append((url, max_bytes, timeout_seconds))
        return self.response


class FakePinnedResponse:
    status = 200

    def __init__(self) -> None:
        self.headers = Message()
        self.headers["Content-Type"] = "text/plain"

    def read(self, size: int) -> bytes:
        del size
        return b"Pinned public response"


class FakePinnedConnection:
    def __init__(self) -> None:
        self.requested: tuple[str, str, dict[str, str]] | None = None

    def request(self, method: str, url: str, *, headers: dict[str, str]) -> None:
        self.requested = (method, url, headers)

    def getresponse(self) -> FakePinnedResponse:
        return FakePinnedResponse()

    def close(self) -> None:
        return None


def test_source_reader_projects_bounded_readable_text() -> None:
    transport = FakeSourceTransport(
        HttpResponse(
            url="https://example.com/project",
            status=200,
            content_type="text/html",
            body=(
                b"<html><title>Project title</title><style>secret-css</style>"
                b"<body><h1>Public story</h1><script>hidden()</script><p>Context here.</p></body>"
                b"</html>"
            ),
        )
    )
    result = SafeSourceReader(transport=transport, max_characters=64).read(
        "https://EXAMPLE.com/project#fragment"
    )

    assert result.title == "Project title"
    assert "Public story" in result.content
    assert "hidden" not in result.content
    assert transport.calls[0][0] == "https://example.com/project"
    assert transport.calls[0][1] == 2_000_000


def test_source_reader_rejects_local_urls_binary_and_oversized_content() -> None:
    assert canonicalize_public_url("https://example.com") == "https://example.com/"
    with pytest.raises(UnsafeSourceError):
        canonicalize_public_url("http://localhost/admin")
    with pytest.raises(UnsafeSourceError):
        canonicalize_public_url("http://127.0.0.1/admin")
    with pytest.raises(UnsafeSourceError):
        canonicalize_public_url("http://user:pass@example.com/")

    def local_resolver(*args: object, **kwargs: object) -> list[tuple[int, int, int, str, tuple[object, ...]]]:
        del args, kwargs
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]

    with pytest.raises(UnsafeSourceError):
        assert_public_host("https://example.com", resolver=local_resolver)

    binary = SafeSourceReader(
        transport=FakeSourceTransport(
            HttpResponse(
                url="https://example.com/file.pdf",
                status=200,
                content_type="application/pdf",
                body=b"pdf",
            )
        )
    )
    with pytest.raises(SourceReadError, match="content type"):
        binary.read("https://example.com/file.pdf")


def test_default_transport_pins_validated_ip_and_prevents_dns_rebinding() -> None:
    resolver_calls = 0

    def rebinding_resolver(*args: object, **kwargs: object) -> list[tuple[Any, ...]]:
        nonlocal resolver_calls
        del args, kwargs
        resolver_calls += 1
        address = "93.184.216.34" if resolver_calls == 1 else "127.0.0.1"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 0))]

    connection = FakePinnedConnection()
    factory_calls: list[tuple[str, str, int, str, float]] = []

    def factory(
        scheme: str, ip: str, port: int, host: str, timeout: float
    ) -> FakePinnedConnection:
        factory_calls.append((scheme, ip, port, host, timeout))
        return connection

    transport = UrllibSourceTransport(
        resolver=rebinding_resolver,
        connection_factory=factory,
    )
    response = transport.get("https://example.com/project", max_bytes=1000, timeout_seconds=2)

    assert response.body == b"Pinned public response"
    assert resolver_calls == 1
    assert factory_calls == [("https", "93.184.216.34", 443, "example.com", 2)]
    assert connection.requested == (
        "GET",
        "/project",
        {
            "Host": "example.com",
            "Accept": "text/html, text/plain;q=0.9",
            "User-Agent": "AudienceTakeSourceReader/0.1 (+https://audiencetake.com)",
            "Connection": "close",
        },
    )
