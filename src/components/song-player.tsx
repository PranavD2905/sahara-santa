"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export interface SongInfo {
  trackId: string;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  explicit: boolean;
}

/**
 * Tap-to-play 30-second preview, no autoplay. The preview URL is fetched on
 * mount so the tap can call play() synchronously (iOS blocks play() after an
 * async gap).
 */
export function SongPlayer({ song }: { song: SongInfo }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "playing" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/songs/preview?trackId=${encodeURIComponent(song.trackId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { previewUrl: string }) => {
        if (cancelled) return;
        setSrc(body.previewUrl);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [song.trackId]);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (status === "playing") {
      el.pause();
      setStatus("ready");
    } else {
      void el.play().then(
        () => setStatus("playing"),
        () => setStatus("unavailable"),
      );
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-300 p-3 text-left dark:border-neutral-700">
      {song.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote artwork thumbnail
        <img src={song.artworkUrl} alt="" width={56} height={56} className="rounded" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {song.title}
          {song.explicit && (
            <span title="Explicit" className="ml-2 rounded bg-neutral-300 px-1 text-xs dark:bg-neutral-700">
              E
            </span>
          )}
        </div>
        <div className="truncate text-sm text-neutral-500">{song.artist}</div>
      </div>
      {status === "unavailable" ? (
        <span className="text-xs text-neutral-500">Preview unavailable</span>
      ) : (
        <Button type="button" onClick={toggle} disabled={status === "loading"}>
          {status === "playing" ? "Pause" : "Play"}
        </Button>
      )}
      {src && <audio ref={audio} src={src} preload="auto" onEnded={() => setStatus("ready")} />}
    </div>
  );
}
