"use client";

/**
 * Site-wide sound: one on/off switch (default on, remembered per browser)
 * shared by the background music and the Reveal sound effect.
 */

const KEY = "sahara-santa:sound";
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

let soundOn: boolean | null = null;

export function isSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  if (soundOn === null) soundOn = readStored();
  return soundOn;
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode etc.: the choice just won't be remembered.
  }
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Reveal sound: synthesized with Web Audio, no file needed.
// A soft "whoosh" as the card turns, then a sparkling major chime with a
// bell overtone and a few high twinkles, through a short echo.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function whoosh(c: AudioContext, out: AudioNode, t: number) {
  const dur = 0.75;
  const noise = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(350, t);
  band.frequency.exponentialRampToValueAtTime(3200, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur);
}

function bell(c: AudioContext, out: AudioNode, freq: number, t: number, level: number, decay = 1.8) {
  // Fundamental plus inharmonic partials gives a glassy, bell-like tone.
  for (const [ratio, amp, type] of [
    [1, 1, "sine"],
    [2.01, 0.35, "sine"],
    [3.98, 0.12, "triangle"],
  ] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * ratio;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / ratio);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** Plays the Reveal sound if sound is on. Safe to call from a click handler. */
export function playRevealSound() {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.02;

  // Master + a short feedback echo for a "magic" tail.
  const master = c.createGain();
  master.gain.value = 0.55;
  const echo = c.createDelay(1);
  echo.delayTime.value = 0.19;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  const wet = c.createGain();
  wet.gain.value = 0.35;
  master.connect(c.destination);
  master.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(c.destination);

  whoosh(c, master, t0);

  // Rising C-major arpeggio landing as the card face turns (~0.55s in).
  const chimeAt = t0 + 0.55;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(c, master, f, chimeAt + i * 0.075, 0.16 - i * 0.02));
  // A low warm "ta-da" under it.
  bell(c, master, 523.25, chimeAt + 0.3, 0.12, 2.4);
  // Random high twinkles, like the card's sparkles.
  for (let i = 0; i < 6; i++) {
    bell(c, master, 2600 + Math.random() * 2400, chimeAt + 0.35 + Math.random() * 0.9, 0.035, 0.5);
  }
}
