export function extractYouTubeId(input: string | null | undefined) {
  if (!input) return null;
  const value = input.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "") && /^[A-Za-z0-9_-]{11}$/.test(parts[1] ?? "")) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

export function safeHttpUrl(input: string | null | undefined) {
  if (!input?.trim()) return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
