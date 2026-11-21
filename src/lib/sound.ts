"use client";

/**
 * Site-wide sound state:
 * - one on/off switch (default on, remembered per browser) for everything;
 * - a "music paused" flag that screens with their own sound (the Reveal)
 *   turn on while they're open, so the background music stops there.
 * Sound effects are mp3 files in public/audio (no generated audio in code).
 */

const KEY = "sahara-santa:sound";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let soundOn: boolean | null = null;
let musicPausedBy = 0;

export function isSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  if (soundOn === null) {
    try {
      soundOn = window.localStorage.getItem(KEY) !== "off";
    } catch {
      soundOn = true;
    }
  }
  return soundOn;
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode etc.: the choice just won't be remembered.
  }
  if (!on) stopAllEffects();
  notify();
}

/** True while some screen (the Reveal) has paused the background music. */
export function isMusicPaused(): boolean {
  return musicPausedBy > 0;
}

/** Pause the background music until the returned function is called. */
export function pauseMusic(): () => void {
  musicPausedBy++;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    musicPausedBy--;
    notify();
  };
}

/** For useSyncExternalStore. */
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Sound effects (mp3 files). A missing file simply stays silent.
// ---------------------------------------------------------------------------

export const SOUNDS = {
  /** Played when the card is clicked on the Reveal screen. Add the file. */
  reveal: "/audio/reveal.mp3",
  /** Played as the chosen card flips over. */
  cardSwoosh: "/audio/card-swoosh.mp3",
} as const;

const effects = new Map<string, HTMLAudioElement>();

function effect(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let el = effects.get(src);
  if (!el) {
    el = new Audio(src);
    el.preload = "auto";
    effects.set(src, el);
  }
  return el;
}

/** Load the effects early so they play instantly on click. */
export function preloadEffects(...srcs: string[]) {
  srcs.forEach((s) => effect(s)?.load());
}

/** Plays a sound effect from the start, if sound is on. */
export function playEffect(src: string, volume = 0.8) {
  if (!isSoundOn()) return;
  const el = effect(src);
  if (!el) return;
  el.volume = volume;
  el.currentTime = 0;
  // A missing file or a blocked play just stays silent.
  void el.play().catch(() => {});
}

export function stopEffect(src: string) {
  const el = effects.get(src);
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}

export function stopAllEffects() {
  effects.forEach((el) => {
    el.pause();
    el.currentTime = 0;
  });
}
