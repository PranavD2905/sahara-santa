import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectBackgroundMusic } from "./background-music";
import { pauseMusic, setSoundOn } from "./sound";

let cleanup: (() => void) | undefined;
let resumeMusic: (() => void) | undefined;

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  setSoundOn(true);
});

afterEach(() => {
  cleanup?.();
  resumeMusic?.();
  cleanup = undefined;
  resumeMusic = undefined;
  vi.unstubAllGlobals();
});

function player() {
  let allowed = false;
  const audio = {
    paused: true,
    volume: 1,
    play: vi.fn(() => {
      // Model browsers that allow silent autoplay, but block audible autoplay.
      if (!allowed && audio.volume > 0) {
        return Promise.reject(new Error("NotAllowedError"));
      }
      audio.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => { audio.paused = true; }),
  };
  return { audio, allowPlayback: () => { allowed = true; } };
}

describe("background music startup", () => {
  it.each(["click", "pointerdown", "pointerup", "touchend", "keydown"])(
    "recovers from blocked autoplay on %s without toggling mute",
    async (event) => {
      const { audio, allowPlayback } = player();
      cleanup = connectBackgroundMusic(audio);
      await Promise.resolve();
      expect(audio.paused).toBe(true);
      expect(audio.volume).toBe(0.35);

      allowPlayback();
      window.dispatchEvent(new Event(event));
      expect(audio.paused).toBe(false);
      expect(audio.play).toHaveBeenCalledTimes(2);
      window.dispatchEvent(new Event(event));
      expect(audio.play).toHaveBeenCalledTimes(2);
    },
  );

  it("respects mute and starts synchronously when sound is enabled", () => {
    const { audio, allowPlayback } = player();
    allowPlayback();
    setSoundOn(false);
    cleanup = connectBackgroundMusic(audio);
    window.dispatchEvent(new Event("click"));
    expect(audio.play).not.toHaveBeenCalled();

    setSoundOn(true);
    expect(audio.paused).toBe(false);
    setSoundOn(false);
    expect(audio.paused).toBe(true);
  });

  it("stays silent on Reveal and resumes when leaving it", () => {
    const { audio, allowPlayback } = player();
    allowPlayback();
    resumeMusic = pauseMusic();
    cleanup = connectBackgroundMusic(audio);
    window.dispatchEvent(new Event("touchend"));
    expect(audio.play).not.toHaveBeenCalled();

    resumeMusic();
    expect(audio.paused).toBe(false);
    resumeMusic = pauseMusic();
    expect(audio.paused).toBe(true);
  });

  it("stops playback and removes retries and subscriptions on cleanup", () => {
    const { audio, allowPlayback } = player();
    allowPlayback();
    const disconnect = connectBackgroundMusic(audio);
    expect(audio.paused).toBe(false);
    disconnect();
    expect(audio.paused).toBe(true);

    window.dispatchEvent(new Event("click"));
    setSoundOn(false);
    setSoundOn(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});
