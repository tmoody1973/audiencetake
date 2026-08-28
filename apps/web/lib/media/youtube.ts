const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value: string): string | null {
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

export function privacyEnhancedYouTubeEmbed(value: string): string | null {
  const videoId = youtubeVideoId(value);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}
