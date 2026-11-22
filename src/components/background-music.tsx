"use client";

import { useEffect, useRef } from "react";
import { connectBackgroundMusic } from "@/lib/background-music";
import { setSoundOn } from "@/lib/sound";

export const BACKGROUND_TRACK = "/audio/background.mp3";

/** Global track slot. Reveal pauses it; the user's global MP3 can be added later. */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // The mute control was removed; discard a saved mute from older visits.
    setSoundOn(true);
    return connectBackgroundMusic(el);
  }, []);

  return <audio ref={audioRef} src={BACKGROUND_TRACK} loop preload="auto" />;
}
