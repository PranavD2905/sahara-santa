"use client";

import { isMusicPaused, isSoundOn, subscribeSound } from "./sound";

const VOLUME = 0.35;
const INTERACTIONS = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
type MusicPlayer = Pick<HTMLAudioElement, "play" | "pause" | "paused" | "volume"> &
  Partial<Pick<HTMLAudioElement, "error" | "load">>;

/** Keep playback in sync with sound settings and retry blocked autoplay on a gesture. */
export function connectBackgroundMusic(player: MusicPlayer): () => void {
  let disposed = false;
  const syncPlayback = () => {
    if (disposed) return;
    if (!isSoundOn() || isMusicPaused()) {
      player.pause();
      return;
    }
    if (!player.paused) return;
    // Retry the global track if it was missing and the MP3 was added later.
    if (player.error) player.load?.();

    // Request audible playback. A silent autoplay can succeed, then get
    // blocked when its volume rises outside a user gesture.
    player.volume = VOLUME;
    void player.play().catch(() => {
      // Keep listening: the next interaction can grant playback permission.
    });
  };

  // Apply sound and Reveal state changes immediately, without waiting for
  // a React effect that could run after the current user gesture has ended.
  const unsubscribe = subscribeSound(syncPlayback);
  for (const event of INTERACTIONS) {
    window.addEventListener(event, syncPlayback, { capture: true, passive: true });
  }
  syncPlayback();

  return () => {
    disposed = true;
    unsubscribe();
    for (const event of INTERACTIONS) {
      window.removeEventListener(event, syncPlayback, true);
    }
    player.pause();
  };
}
