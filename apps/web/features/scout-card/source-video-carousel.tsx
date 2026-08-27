"use client";

import { useState } from "react";

import type { ScoutCard } from "./types";

const MAX_SOURCE_VIDEOS = 5;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export type SourceVideo = {
  id: string;
  title: string;
  sourceUrl: string;
  embedUrl: string;
  attribution: string;
  accessibleFallback: string;
  provenance: string;
};

function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;

    if (hostname === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      candidate = url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    }

    return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function provenanceLabel(origin: ScoutCard["sourceLedger"][number]["origin"], verificationStatus: ScoutCard["sourceLedger"][number]["verificationStatus"]): string {
  return `${origin.replace("_", " ")} / ${verificationStatus}`;
}

export function sourceVideosForCard(card: ScoutCard): SourceVideo[] {
  if (card.media.state !== "authorized_embed" || !card.media.embedUrl) return [];

  const primaryVideoId = youtubeVideoId(card.media.sourceUrl) ?? youtubeVideoId(card.media.embedUrl);
  const primaryLedgerEntry = card.sourceLedger.find((source) => {
    if (source.url === card.media.sourceUrl) return true;
    const sourceVideoId = youtubeVideoId(source.url);
    return Boolean(primaryVideoId && sourceVideoId === primaryVideoId);
  });
  const seen = new Set([primaryVideoId ? `youtube:${primaryVideoId}` : `url:${card.media.sourceUrl}`]);
  const videos: SourceVideo[] = [{
    id: primaryLedgerEntry?.id ?? "primary-source-video",
    title: card.media.title,
    sourceUrl: card.media.sourceUrl,
    embedUrl: card.media.embedUrl,
    attribution: card.media.attribution,
    accessibleFallback: card.media.accessibleFallback,
    provenance: primaryLedgerEntry
      ? provenanceLabel(primaryLedgerEntry.origin, primaryLedgerEntry.verificationStatus)
      : "primary source",
  }];

  for (const source of card.sourceLedger) {
    if (videos.length >= MAX_SOURCE_VIDEOS || source.availability !== "available") continue;
    const videoId = youtubeVideoId(source.url);
    if (!videoId || seen.has(`youtube:${videoId}`)) continue;
    seen.add(`youtube:${videoId}`);
    videos.push({
      id: source.id,
      title: source.title,
      sourceUrl: source.url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      attribution: `${source.title}. Audience Take embeds the public source and does not rehost it.`,
      accessibleFallback: `Open ${source.title} on YouTube if the embedded player is unavailable.`,
      provenance: provenanceLabel(source.origin, source.verificationStatus),
    });
  }

  return videos;
}

export function SourceVideoCarousel({ card }: { card: ScoutCard }) {
  const videos = sourceVideosForCard(card);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVideo = videos[activeIndex] ?? videos[0];
  if (!activeVideo) return null;

  const selectVideo = (index: number) => setActiveIndex(Math.max(0, Math.min(index, videos.length - 1)));

  return (
    <div className="scout-media-carousel" aria-label={`Source video carousel, ${videos.length} ${videos.length === 1 ? "video" : "videos"}`}>
      <div className="scout-media-frame">
        <div className="source-video-meta">
          <span>Source video {activeIndex + 1} / {videos.length}</span>
          <span>{activeVideo.provenance}</span>
        </div>
        <iframe
          key={activeVideo.id}
          src={activeVideo.embedUrl}
          title={activeVideo.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <div className="source-video-caption">
          <p>{activeVideo.attribution}</p>
          <a href={activeVideo.sourceUrl} target="_blank" rel="noreferrer">Open source video</a>
        </div>
      </div>

      {videos.length > 1 ? (
        <div className="source-video-controls">
          <button type="button" onClick={() => selectVideo(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous source video">Previous</button>
          <div className="source-video-picker" role="group" aria-label="Choose a source video">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                className={index === activeIndex ? "is-active" : undefined}
                aria-pressed={index === activeIndex}
                aria-label={`Show source video ${index + 1}: ${video.title}`}
                onClick={() => selectVideo(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{video.title}</strong>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => selectVideo(activeIndex + 1)} disabled={activeIndex === videos.length - 1} aria-label="Next source video">Next</button>
          <p className="sr-only" aria-live="polite" aria-atomic="true">Now showing source video {activeIndex + 1} of {videos.length}: {activeVideo.title}</p>
        </div>
      ) : null}
    </div>
  );
}
