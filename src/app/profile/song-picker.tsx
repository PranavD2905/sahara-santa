"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SongPlayer, type SongInfo } from "@/components/song-player";
import { Button, Field, Notice } from "@/components/ui";
import type { SongResult } from "@/lib/songs";
import { chooseSongAction, clearSongAction, searchSongsAction } from "./actions";

export function SongPicker({ current }: { current: SongInfo | null }) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SongResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced search as you type.
  useEffect(() => {
    if (term.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await searchSongsAction(term);
      setResults(r.results);
      setError(r.error ?? (r.results.length === 0 ? "No songs found." : null));
    }, 350);
    return () => clearTimeout(t);
  }, [term]);

  function choose(trackId: string) {
    startTransition(async () => {
      const r = await chooseSongAction(trackId);
      if (r.error) setError(r.error);
      else {
        setTerm("");
        setResults([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {current ? (
        <>
          <SongPlayer song={current} />
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => startTransition(async () => void (await clearSongAction(), router.refresh()))}
          >
            Remove song
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">No song picked yet.</p>
      )}

      <Field
        label={current ? "Change song" : "Search for a song"}
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          if (e.target.value.trim().length < 2) {
            setResults([]);
            setError(null);
          }
        }}
        placeholder="Title or artist"
        autoComplete="off"
      />
      <Notice>{error}</Notice>
      {results.length > 0 && (
        <ul className="divide-y divide-ink/10 rounded-md border-[1.5px] border-ink/30 bg-paper">
          {results.map((s) => (
            <li key={s.trackId} className="flex items-center gap-3 p-2">
              {s.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- remote artwork thumbnail
                <img src={s.artworkUrl} alt="" width={40} height={40} className="rounded" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {s.title}
                  {s.explicit && <span className="ml-1 rounded bg-ink px-1 text-[10px] text-cream">E</span>}
                </div>
                <div className="truncate text-xs text-muted">{s.artist}</div>
              </div>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => choose(s.trackId)}>
                Choose
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
