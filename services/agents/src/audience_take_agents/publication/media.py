"""Deterministic projection and validation helpers for public Scout Card media."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlsplit

_YOUTUBE_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_HOSTS = {"youtube.com", "m.youtube.com", "music.youtube.com"}
_YOUTUBE_EMBED_HOST = "youtube-nocookie.com"


def youtube_video_id(value: str) -> str | None:
    """Return a validated video ID for supported first-party YouTube URL forms."""
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        return None

    host = (parsed.hostname or "").casefold().removeprefix("www.")
    parts = [part for part in parsed.path.split("/") if part]
    candidate: str | None = None

    if host == "youtu.be" and parts:
        candidate = parts[0]
    elif host in _YOUTUBE_HOSTS:
        if parsed.path.rstrip("/") == "/watch":
            candidate = parse_qs(parsed.query).get("v", [None])[0]
        elif len(parts) == 2 and parts[0] in {"embed", "shorts", "live"}:
            candidate = parts[1]
    elif host == _YOUTUBE_EMBED_HOST and len(parts) == 2 and parts[0] == "embed":
        candidate = parts[1]

    return candidate if candidate and _YOUTUBE_VIDEO_ID.fullmatch(candidate) else None


def privacy_enhanced_youtube_embed(source_url: str) -> str | None:
    """Project a supported YouTube source into a fixed no-cookie embed URL."""
    video_id = youtube_video_id(source_url)
    if video_id is None:
        return None
    return f"https://www.youtube-nocookie.com/embed/{video_id}"


def project_submitted_media(submitted_url: str, title: str) -> dict[str, Any]:
    """Create an honest media payload, falling back when no safe embed is known."""
    embed_url = privacy_enhanced_youtube_embed(submitted_url)
    if embed_url is not None:
        return {
            "state": "authorized_embed",
            "title": f"Watch the submitted public source for {title}"[:240],
            "sourceUrl": submitted_url,
            "embedUrl": embed_url,
            "attribution": (
                "Embedded from the fan-submitted public YouTube source; "
                "Audience Take does not rehost the video."
            ),
            "accessibleFallback": (
                "Open the submitted source on YouTube if the embedded player is unavailable."
            ),
        }
    return {
        "state": "editorial_fallback",
        "title": f"Open the submitted public source for {title}"[:240],
        "sourceUrl": submitted_url,
        "attribution": (
            "Linked from the submitted public source; "
            "Audience Take does not rehost third-party media."
        ),
        "accessibleFallback": "Open the submitted public source in a new browser tab.",
    }
