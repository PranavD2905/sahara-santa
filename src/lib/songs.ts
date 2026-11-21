import "server-only";

/**
 * Songs come from the iTunes Search API (ADR 0003). We store only the
 * track's id/title/artist/artwork; the preview URL is fetched at play time
 * because preview URLs can expire.
 */

export interface SongResult {
  trackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  explicit: boolean;
}

interface ItunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackExplicitness?: string;
  kind?: string;
}

const ITUNES = "https://itunes.apple.com";

async function itunes(path: string, params: Record<string, string>): Promise<ItunesTrack[]> {
  const url = `${ITUNES}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`iTunes ${path} failed: ${res.status}`);
  const body = (await res.json()) as { results?: ItunesTrack[] };
  return (body.results ?? []).filter((t) => t.kind === "song" && t.trackId);
}

function toSong(t: ItunesTrack): SongResult {
  return {
    trackId: String(t.trackId),
    title: t.trackName ?? "Unknown title",
    artist: t.artistName ?? "Unknown artist",
    artworkUrl: t.artworkUrl100 ?? null,
    explicit: t.trackExplicitness === "explicit",
  };
}

export async function searchSongs(term: string): Promise<SongResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const tracks = await itunes("/search", {
    term: q.slice(0, 100),
    media: "music",
    entity: "song",
    limit: "10",
  });
  return tracks.filter((t) => t.previewUrl).map(toSong);
}

export async function lookupSong(trackId: string): Promise<(SongResult & { previewUrl: string | null }) | null> {
  if (!/^\d{1,15}$/.test(trackId)) return null;
  const [t] = await itunes("/lookup", { id: trackId });
  if (!t) return null;
  return { ...toSong(t), previewUrl: t.previewUrl ?? null };
}
