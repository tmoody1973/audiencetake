"""The single server-side Parallel Search integration."""

from __future__ import annotations

import asyncio
import json
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, ValidationError

PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search"


class ParallelSearchError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool, status_code: int | None = None) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code


@dataclass(frozen=True)
class TransportResponse:
    status_code: int
    payload: dict[str, Any]


class ParallelTransport(Protocol):
    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any],
        timeout_seconds: float,
    ) -> TransportResponse: ...


class UrllibParallelTransport:
    async def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, Any],
        timeout_seconds: float,
    ) -> TransportResponse:
        def send() -> TransportResponse:
            request = Request(
                url,
                data=json.dumps(json_body).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urlopen(request, timeout=timeout_seconds) as response:
                    payload = json.loads(response.read(2_000_001))
                    if not isinstance(payload, dict):
                        raise ParallelSearchError("Parallel returned invalid JSON", retryable=False)
                    return TransportResponse(status_code=int(response.status), payload=payload)
            except HTTPError as error:
                try:
                    payload = json.loads(error.read(64_000))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    payload = {}
                return TransportResponse(status_code=error.code, payload=payload)
            except (URLError, TimeoutError, OSError) as error:
                raise ParallelSearchError("Parallel request failed", retryable=True) from error

        return await asyncio.to_thread(send)


class ParallelResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    url: str
    title: str
    publish_date: str | None = None
    excerpts: list[str] = Field(default_factory=list)


class ParallelResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    search_id: str
    results: list[ParallelResult] = Field(default_factory=list)
    warnings: list[str] | None = None


Sleep = Callable[[float], Awaitable[None]]


class ParallelSearchClient:
    """Bounded Parallel client; credentials never enter payloads, events, or errors."""

    tool_name = "Parallel Search"

    def __init__(
        self,
        *,
        api_key: str | None,
        transport: ParallelTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        max_attempts: int = 1,
        timeout_seconds: float = 20.0,
        random_seed: int = 0,
    ) -> None:
        self._api_key = api_key.strip() if api_key else None
        self._transport = transport or UrllibParallelTransport()
        self._sleep = sleep
        self._max_attempts = max_attempts
        self._timeout_seconds = timeout_seconds
        self._random = random.Random(random_seed)

    async def search(self, *, objective: str, search_queries: list[str]) -> ParallelResponse:
        objective = objective.strip()
        queries = [query.strip() for query in search_queries]
        if not self._api_key:
            raise ParallelSearchError("Parallel Search is not configured", retryable=True)
        if not objective or len(objective) > 800:
            raise ValueError("objective must contain 1 to 800 characters")
        if not 2 <= len(queries) <= 3:
            raise ValueError("Parallel Search requires two or three queries")
        if len({query.casefold() for query in queries}) != len(queries):
            raise ValueError("Parallel Search queries must be unique")
        if any(not 2 <= len(query) <= 120 for query in queries):
            raise ValueError("Parallel Search queries must contain 2 to 120 characters")
        body = {
            "objective": objective,
            "search_queries": queries,
            "mode": "basic",
            "max_chars_total": 12_000,
            "advanced_settings": {
                "max_results": 10,
                "excerpt_settings": {"max_chars_per_result": 1_200},
            },
        }
        for attempt in range(self._max_attempts):
            try:
                response = await self._transport.post(
                    PARALLEL_SEARCH_URL,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self._api_key,
                    },
                    json_body=body,
                    timeout_seconds=self._timeout_seconds,
                )
            except ParallelSearchError:
                if attempt + 1 >= self._max_attempts:
                    raise
                await self._backoff(attempt)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                if attempt + 1 < self._max_attempts:
                    await self._backoff(attempt)
                    continue
                raise ParallelSearchError(
                    "Parallel Search is temporarily unavailable",
                    retryable=True,
                    status_code=response.status_code,
                )
            if response.status_code < 200 or response.status_code >= 300:
                raise ParallelSearchError(
                    "Parallel Search rejected the request",
                    retryable=False,
                    status_code=response.status_code,
                )
            try:
                return ParallelResponse.model_validate(response.payload)
            except ValidationError as error:
                raise ParallelSearchError(
                    "Parallel Search returned an invalid response", retryable=False
                ) from error
        raise AssertionError("bounded retry loop did not terminate")

    async def _backoff(self, attempt: int) -> None:
        delay = min(4.0, 0.5 * (2**attempt)) + self._random.uniform(0.0, 0.25)
        await self._sleep(delay)
