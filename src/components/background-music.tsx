"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isMusicPaused, isSoundOn, setSoundOn, subscribeSound } from "@/lib/sound";

/**
 * Drop the theme track at public/audio/background.mp3. Until it exists the
 * player stays silent; the button also mutes the Reveal sounds.
 */
export const BACKGROUND_TRACK = "/audio/background.mp3";
const VOLUME = 0.35;

/**
 * Site-wide background music with a mute button (top-right, on every page).
 * Lives in the root layout, so it keeps playing across page navigations.
 * Sound defaults to on; browsers only allow audio after the visitor's first
 * click/tap/keypress, so playback starts then.
 */
export function BackgroundMusic() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  // Screens with their own sound (the Reveal) pause the music while open.
  const paused = useSyncExternalStore(subscribeSound, isMusicPaused, () => false);
  const shouldPlay = on && !paused;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || missing) return;
    if (!shouldPlay) {
      el.pause();
      return;
    }

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      el.volume = 0;
      el.play().then(
        () => {
          // Gentle fade-in.
          const t0 = performance.now();
          const step = (now: number) => {
            if (cancelled || el.paused) return;
            el.volume = Math.min(VOLUME, (VOLUME * (now - t0)) / 1200);
            if (el.volume < VOLUME) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          removeUnlock();
        },
        () => {
          // Autoplay blocked: wait for the first interaction.
        },
      );
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const unlock = () => start();
    const removeUnlock = () => events.forEach((e) => window.removeEventListener(e, unlock));
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    start();

    return () => {
      cancelled = true;
      removeUnlock();
    };
  }, [shouldPlay, missing]);

  return (
    <>
      <audio ref={audioRef} src={BACKGROUND_TRACK} loop preload="auto" onError={() => setMissing(true)} />
      <button
        type="button"
        onClick={() => setSoundOn(!on)}
        aria-pressed={!on}
        aria-label={on ? "Mute sound" : "Turn sound on"}
        title={on ? (missing ? "Mute sound (music not added yet)" : "Mute sound") : "Turn sound on"}
        className="fixed top-3 right-3 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-sand-lt/40 bg-night/70 text-cream shadow-[0_6px_20px_rgba(10,8,40,0.45)] backdrop-blur-sm transition hover:border-sand-lt hover:bg-night/90 sm:top-4 sm:right-4"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.25" />
          {on ? (
            <>
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
            </>
          ) : (
            <path d="M16 9.5l5 5M21 9.5l-5 5" />
          )}
        </svg>
      </button>
    </>
  );
}
