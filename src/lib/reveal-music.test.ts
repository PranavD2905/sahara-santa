import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRevealMusic } from "./reveal-music";
import { setSoundOn } from "./sound";

let music: ReturnType<typeof connectRevealMusic> | undefined;
beforeEach(() => {
  vi.stubGlobal("window", { localStorage: { setItem: vi.fn() } });
  setSoundOn(true);
});
afterEach(() => { music?.destroy(); music = undefined; vi.unstubAllGlobals(); });

function player() {
  return { muted: false, currentTime: 0, volume: 1, pause: vi.fn(), play: vi.fn(() => Promise.resolve()) };
}

describe("reveal song", () => {
  it("stays muted through the shuffle and starts from the beginning on the flip cue", () => {
    const audio = player();
    music = connectRevealMusic(audio);
    expect(audio.play).not.toHaveBeenCalled();
    music.prepare();
    expect(audio.muted).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    audio.currentTime = 18;
    music.play();
    expect(audio.muted).toBe(false);
    expect(audio.currentTime).toBe(0);
  });

  it("silences a replay and stops when leaving the reveal", () => {
    const audio = player();
    music = connectRevealMusic(audio);
    music.prepare();
    music.play();
    music.prepare();
    expect(audio.muted).toBe(true);
    music.destroy();
    const calls = audio.play.mock.calls.length;
    music.play();
    music.prepare();
    expect(audio.play).toHaveBeenCalledTimes(calls);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("stays silent after a failed draw or disabled sound", () => {
    const audio = player();
    music = connectRevealMusic(audio);
    music.prepare();
    music.stop();
    expect(audio.muted).toBe(true);
    setSoundOn(false);
    const calls = audio.play.mock.calls.length;
    music.play();
    expect(audio.play).toHaveBeenCalledTimes(calls);
  });
});
