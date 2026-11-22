"use client";

import { isSoundOn, subscribeSound } from "./sound";

export const REVEAL_TRACK = "/audio/reveal-song.mp3";
type RevealPlayer = Pick<HTMLAudioElement, "play" | "pause" | "muted" | "volume" | "currentTime">;

/** Unlock during the draw click, but keep the song inaudible until the flip cue. */
export function connectRevealMusic(player: RevealPlayer) {
  let disposed = false;
  const stop = () => {
    player.muted = true;
    player.pause();
    player.currentTime = 0;
  };
  const prepare = () => {
    if (disposed || !isSoundOn()) return;
    stop();
    player.volume = 0.35;
    // play() runs synchronously in the user's click so Safari also unlocks
    // this exact element. It stays muted until the chosen card starts flipping.
    void player.play().catch(() => {});
  };
  const play = () => {
    if (disposed || !isSoundOn()) return;
    player.currentTime = 0;
    player.muted = false;
    void player.play().catch(() => {});
  };
  const unsubscribe = subscribeSound(() => { if (!isSoundOn()) stop(); });
  return {
    prepare,
    play,
    stop,
    destroy: () => { disposed = true; unsubscribe(); stop(); },
  };
}
