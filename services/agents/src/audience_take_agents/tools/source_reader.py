"""Bounded public-source reader with SSRF and response-size protections."""

from __future__ import annotations

import http.client
import ipaddress
import re
import socket
import ssl
from collections.abc import Callable
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Any, Protocol
from urllib.parse import urljoin, urlsplit, urlunsplit


class UnsafeSourceError(ValueError):
    """The submitted source is not safe for a server-side fetch."""


class SourceReadError(RuntimeError):
    """The public source could not be read without inventing content."""


@dataclass(frozen=True)
class HttpResponse:
    url: str
    status: int
    content_type: str
    body: bytes


class SourceTransport(Protocol):
    def get(self, url: str, *, max_bytes: int, timeout_seconds: float) -> HttpResponse: ...


Resolver = Callable[..., Any]


def canonicalize_public_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise UnsafeSourceError("source URL must be public HTTP(S)")
    if parsed.username or parsed.password:
        raise UnsafeSourceError("source URL cannot include credentials")
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(".local"):
        raise UnsafeSourceError("local source hosts are not allowed")
    try:
        literal_ip = ipaddress.ip_address(host)
    except ValueError:
        literal_ip = None
    if literal_ip is not None and not literal_ip.is_global:
        raise UnsafeSourceError("non-public source addresses are not allowed")
    try:
        port = parsed.port
    except ValueError as error:
        raise UnsafeSourceError("source URL has an invalid port") from error
    if port not in {None, 80, 443}:
        raise UnsafeSourceError("source URL uses a disallowed port")
    netloc = host
    if port is not None and not (
        parsed.scheme.lower() == "http" and port == 80
    ) and not (parsed.scheme.lower() == "https" and port == 443):
        netloc = f"{host}:{port}"
    path = parsed.path or "/"
    return urlunsplit((parsed.scheme.lower(), netloc, path, parsed.query, ""))


@dataclass(frozen=True)
class ResolvedTarget:
    url: str
    host: str
    ip: str
    port: int
    scheme: str


def resolve_public_target(url: str, resolver: Resolver = socket.getaddrinfo) -> ResolvedTarget:
    canonical = canonicalize_public_url(url)
    parsed = urlsplit(canonical)
    host = parsed.hostname
    assert host is not None
    try:
        addresses = resolver(host, None, type=socket.SOCK_STREAM)
    except OSError as error:
        raise SourceReadError("source host could not be resolved") from error
    if not addresses:
        raise SourceReadError("source host did not resolve")
    public_ips: list[str] = []
    for address in addresses:
        ip = ipaddress.ip_address(str(address[4][0]))
        if not ip.is_global:
            raise UnsafeSourceError("source host resolves to a non-public address")
        public_ips.append(str(ip))
    return ResolvedTarget(
        url=canonical,
        host=host,
        ip=public_ips[0],
        port=parsed.port or (443 if parsed.scheme == "https" else 80),
        scheme=parsed.scheme,
    )


def assert_public_host(url: str, resolver: Resolver = socket.getaddrinfo) -> str:
    return resolve_public_target(url, resolver).url


class PinnedConnection(Protocol):
    def request(self, method: str, url: str, *, headers: dict[str, str]) -> None: ...

    def getresponse(self) -> Any: ...

    def close(self) -> None: ...


ConnectionFactory = Callable[[str, str, int, str, float], PinnedConnection]


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, ip: str, port: int, host_name: str, timeout: float) -> None:
        super().__init__(ip, port=port, timeout=timeout, context=ssl.create_default_context())
        self._host_name = host_name
        self._ssl_context = ssl.create_default_context()

    def connect(self) -> None:
        raw_socket = socket.create_connection((self.host, self.port), self.timeout)
        self.sock = self._ssl_context.wrap_socket(raw_socket, server_hostname=self._host_name)


def _default_connection_factory(
    scheme: str, ip: str, port: int, host: str, timeout: float
) -> PinnedConnection:
    if scheme == "https":
        return _PinnedHTTPSConnection(ip, port, host, timeout)
    return http.client.HTTPConnection(ip, port=port, timeout=timeout)


class UrllibSourceTransport:
    """HTTP transport pinned to the DNS-vetted IP, including TLS SNI for the host."""

    def __init__(
        self,
        resolver: Resolver = socket.getaddrinfo,
        connection_factory: ConnectionFactory = _default_connection_factory,
        max_redirects: int = 3,
    ) -> None:
        self._resolver = resolver
        self._connection_factory = connection_factory
        self._max_redirects = max_redirects

    def get(self, url: str, *, max_bytes: int, timeout_seconds: float) -> HttpResponse:
        current = url
        for redirect_count in range(self._max_redirects + 1):
            target = resolve_public_target(current, self._resolver)
            parsed = urlsplit(target.url)
            request_target = parsed.path or "/"
            if parsed.query:
                request_target = f"{request_target}?{parsed.query}"
            connection = self._connection_factory(
                target.scheme,
                target.ip,
                target.port,
                target.host,
                timeout_seconds,
            )
            try:
                connection.request(
                    "GET",
                    request_target,
                    headers={
                        "Host": target.host,
                        "Accept": "text/html, text/plain;q=0.9",
                        "User-Agent": (
                            "AudienceTakeSourceReader/0.1 (+https://audiencetake.com)"
                        ),
                        "Connection": "close",
                    },
                )
                response = connection.getresponse()
                if int(response.status) in {301, 302, 303, 307, 308}:
                    location = response.headers.get("Location")
                    if not location:
                        raise SourceReadError("source redirect omitted a location")
                    if redirect_count >= self._max_redirects:
                        raise SourceReadError("source exceeded the redirect limit")
                    current = urljoin(target.url, str(location))
                    continue
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    raise SourceReadError("source exceeded the response-size limit")
                return HttpResponse(
                    url=target.url,
                    status=int(response.status),
                    content_type=response.headers.get_content_type(),
                    body=body,
                )
            except (TimeoutError, OSError, http.client.HTTPException) as error:
                raise SourceReadError("source request failed") from error
            finally:
                connection.close()
        raise SourceReadError("source exceeded the redirect limit")


class _ReadableHtml(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self._in_title = False
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag == "title":
            self._in_title = True
        if tag in {"script", "style", "noscript", "svg"}:
            self._ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag in {"script", "style", "noscript", "svg"} and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        if self._in_title:
            self.title_parts.append(data)
        self.text_parts.append(data)


@dataclass(frozen=True)
class ReadSource:
    url: str
    title: str
    content: str


class SafeSourceReader:
    """Read a small text projection, never raw binary or unbounded page content."""

    def __init__(
        self,
        transport: SourceTransport | None = None,
        *,
        # Modern public video pages can exceed 512 KB before scripts/styles are
        # stripped. Keep the wire read bounded at 2 MB and the model-facing
        # projection independently bounded at 32,000 characters.
        max_bytes: int = 2_000_000,
        max_characters: int = 32_000,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._transport = transport or UrllibSourceTransport()
        self._max_bytes = max_bytes
        self._max_characters = max_characters
        self._timeout_seconds = timeout_seconds

    def read(self, url: str) -> ReadSource:
        response = self._transport.get(
            canonicalize_public_url(url),
            max_bytes=self._max_bytes,
            timeout_seconds=self._timeout_seconds,
        )
        if response.status < 200 or response.status >= 300:
            raise SourceReadError("source returned a non-success status")
        if response.content_type not in {"text/html", "text/plain", "application/xhtml+xml"}:
            raise SourceReadError("source content type is not safely readable")
        decoded = response.body.decode("utf-8", errors="replace")
        title = urlsplit(response.url).hostname or "Submitted public source"
        if response.content_type in {"text/html", "application/xhtml+xml"}:
            parser = _ReadableHtml()
            parser.feed(decoded)
            title_candidate = _clean_text(" ".join(parser.title_parts))
            if title_candidate:
                title = title_candidate[:500]
            decoded = " ".join(parser.text_parts)
        content = _clean_text(decoded)[: self._max_characters]
        if not content:
            raise SourceReadError("source did not contain readable public text")
        return ReadSource(url=response.url, title=title, content=content)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(value)).strip()
