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
  /** Recorded card rustle when the deck is clicked on the Reveal screen. */
  reveal: "/audio/reveal.mp3",
  /** One card flicked/dealt (shuffle riffle and the deal). */
  cardDeal: "/audio/card-deal.mp3",
  /** A card sliding on the table (shell-game swaps). */
  cardSlide: "/audio/card-slide.mp3",
  /** Snare roll while the spotlight wanders; its final hit lands on the pick. */
  drumroll: "/audio/drumroll.mp3",
  /** The chosen card flips over. */
  cardSwoosh: "/audio/card-swoosh.mp3",
} as const;

// Alternate real takes rather than relying on pitch shifts of one recording.
// Keep the first file's URL as the cue key so stopping a cue stops every take.
const takes: Record<string, readonly string[]> = {
  [SOUNDS.cardDeal]: [SOUNDS.cardDeal, "/audio/card-deal-2.mp3", "/audio/card-deal-3.mp3"],
  [SOUNDS.cardSlide]: [SOUNDS.cardSlide, "/audio/card-slide-2.mp3", "/audio/card-slide-3.mp3"],
};
const lastTake = new Map<string, string>();

/*
 * Effects play through Web Audio: each mp3 is fetched and decoded once, then
 * any number of copies can overlap (13 rapid card deals) with a little pitch
 * variation, and everything playing can be stopped at once.
 */
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const playing = new Map<string, Set<AudioBufferSourceNode>>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

function buffer(src: string): Promise<AudioBuffer | null> {
  let b = buffers.get(src);
  if (!b) {
    const c = audio();
    b = c
      ? fetch(src)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((data) => c.decodeAudioData(data))
          // A missing or broken file just stays silent.
          .catch(() => null)
      : Promise.resolve(null);
    buffers.set(src, b);
  }
  return b;
}

/** Fetch and decode effects early so they play instantly on cue. */
export function preloadEffects(...srcs: string[]) {
  srcs.flatMap((s) => takes[s] ?? [s]).forEach((s) => void buffer(s));
}

/**
 * Plays a sound effect if sound is on. `vary` randomises pitch/speed a
 * little (e.g. 0.08 = ±8%) so repeated sounds don't feel robotic.
 */
export function playEffect(src: string, { volume = 0.8, vary = 0 }: { volume?: number; vary?: number } = {}) {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const alternatives = takes[src]?.filter((take) => take !== lastTake.get(src));
  const take = alternatives?.[Math.floor(Math.random() * alternatives.length)] ?? src;
  lastTake.set(src, take);
  void buffer(take).then((b) => {
    if (!b || !isSoundOn()) return;
    const node = c.createBufferSource();
    node.buffer = b;
    if (vary) node.playbackRate.value = 1 + (Math.random() * 2 - 1) * vary;
    const gain = c.createGain();
    gain.gain.value = volume;
    node.connect(gain).connect(c.destination);
    const set = playing.get(src) ?? new Set<AudioBufferSourceNode>();
    playing.set(src, set);
    set.add(node);
    node.onended = () => set.delete(node);
    node.start();
  });
}

export function stopEffect(src: string) {
  const set = playing.get(src);
  set?.forEach((n) => {
    try {
      n.stop();
    } catch {
      // Already stopped.
    }
  });
  set?.clear();
}

export function stopAllEffects() {
  playing.forEach((_, src) => stopEffect(src));
}
