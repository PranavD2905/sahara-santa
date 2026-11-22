"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackButton } from "@/components/back-button";
import { connectRevealMusic, REVEAL_TRACK } from "@/lib/reveal-music";
import { SOUNDS, pauseMusic, playEffect, preloadEffects, stopAllEffects, stopEffect } from "@/lib/sound";
import type { RevealView } from "@/server/groups";
import { revealAction } from "../../../actions";
import { mountTarot, type TarotHandle, type TarotPerson, type TarotPhase } from "./engine";
import "./tarot.css";

const toPerson = (v: RevealView): TarotPerson => ({ name: v.receiver.name, image: v.receiver.image });

/** Touch devices say "Tap", pointers say "Click". */
function useTouch() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(hover: none)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(hover: none)").matches,
    () => false,
  );
}

const Sparkle = () => (
  <svg viewBox="-5 -7 10 14" aria-hidden="true">
    <path d="M0 -7 Q0 0 2.4 0 Q0 0 0 7 Q0 0 -2.4 0 Q0 0 0 -7Z" />
  </svg>
);

/**
 * The tarot Reveal: a deck the Member clicks, a shell-game Draw animation,
 * and the chosen card flipping onto their person. The first click performs
 * the Reveal on the server (`revealAction`); after that, replays are purely
 * visual and always land on the same person.
 */
export function TarotReveal({
  groupId,
  groupName,
  initialView,
  fontClassName,
}: {
  groupId: string;
  groupName: string;
  /** Present when this Member has already revealed. */
  initialView: RevealView | null;
  fontClassName: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const songRef = useRef<HTMLAudioElement>(null);
  const handleRef = useRef<TarotHandle | null>(null);
  const viewRef = useRef<RevealView | null>(initialView);
  const [phase, setPhase] = useState<TarotPhase>("ready");
  const [view, setView] = useState<RevealView | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [hasRevealed, setHasRevealed] = useState(Boolean(initialView));
  const touch = useTouch();

  useEffect(() => {
    const root = rootRef.current;
    const audio = songRef.current;
    if (!root || !audio) return;
    const song = connectRevealMusic(audio);
    // A fresh engine always starts at the deck. When Next.js brings this page
    // back from its hidden (Activity) state, React keeps the old state, so
    // reset it too; replaying still lands on the same person (viewRef).
    setPhase("ready");
    setView(null);
    setError("");
    const handle = mountTarot(root, {
      known: viewRef.current ? toPerson(viewRef.current) : null,
      fetchPerson: async () => {
        const v = await revealAction(groupId);
        viewRef.current = v;
        return v ? toPerson(v) : null;
      },
      onPhase: (p) => {
        setPhase(p);
        setView(p === "revealed" ? viewRef.current : null);
        if (p === "revealed") {
          setHasRevealed(true);
        } else if (p === "ready") song.stop();
      },
      onError: setError,
      onAnnounce: setAnnouncement,
      // The Reveal has its own sound, all mp3s in public/audio:
      // a card rustle on the click, card sounds through the shuffle and deal,
      // a drumroll under the spotlight, and a swoosh as the card flips.
      onDraw: () => {
        song.prepare();
        playEffect(SOUNDS.reveal, { volume: 0.85 });
      },
      onCue: (cue) => {
        if (cue === "riffle") playEffect(SOUNDS.cardDeal, { volume: 0.28, vary: 0.035 });
        else if (cue === "deal") playEffect(SOUNDS.cardDeal, { volume: 0.5, vary: 0.025 });
        else if (cue === "slide") playEffect(SOUNDS.cardSlide, { volume: 0.32, vary: 0.035 });
        else if (cue === "drumroll") playEffect(SOUNDS.drumroll, { volume: 0.5 });
        else if (cue === "cancel") stopEffect(SOUNDS.drumroll);
      },
      onFlip: () => {
        // Start on the flip cue, with no timeout or animation-completion delay.
        song.play();
        playEffect(SOUNDS.cardSwoosh, { volume: 0.7 });
      },
    });
    handleRef.current = handle;
    // Stop the site's background music while this screen is open.
    const resumeMusic = pauseMusic();
    preloadEffects(...Object.values(SOUNDS));
    return () => {
      handle.destroy();
      handleRef.current = null;
      stopAllEffects();
      song.destroy();
      resumeMusic();
    };
  }, [groupId]);

  // Once the details panel has rendered, let the card make room for it.
  useEffect(() => {
    if (phase === "revealed" && view) handleRef.current?.layoutPanel();
  }, [phase, view]);

  const verb = touch ? "Tap" : "Click";
  const firstName = view?.receiver.name.split(/\s+/)[0] ?? "";
  const promptText = phase === "revealed" ? `Drag to turn · ${verb} to replay` : `${verb} on the card to reveal`;
  const note = error
    ? error
    : phase === "ready" && !hasRevealed
      ? "Make sure nobody is looking at your screen."
      : "";

  return (
    <div ref={rootRef} className={`tr-root ${fontClassName}`} role="region" aria-label="Reveal your person">
      <audio ref={songRef} src={REVEAL_TRACK} preload="auto" loop />
      <canvas className="tr-sky" aria-hidden="true" />

      <div className="tr-back">
        <BackButton fallback={`/groups/${groupId}`} />
      </div>
      <header className="tr-brand">
        <h1>Sahara Santa</h1>
        <p>{groupName}</p>
      </header>

      <div className="tr-stage">
        <div className="tr-anchor tr-group" aria-hidden="true" />
        <div className="tr-anchor">
          <div className="tr-halo">
            <div className="tr-halo-in">
              <div className="tr-rays" />
            </div>
          </div>
          <div className="tr-reveal" aria-hidden="true">
            <div className="tr-float">
              <div className="tr-drag">
                <div className="tr-inner">
                  <div className="tr-face tr-face-back">
                    <div className="tr-gl" />
                    <div className="tr-gr" />
                  </div>
                  <div className="tr-face tr-face-front">
                    <div className="tr-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated Profile Picture */}
                      <img alt="" hidden />
                      <span className="tr-initials" hidden />
                    </div>
                    <div className="tr-label">Your person</div>
                    <div className="tr-name" />
                    <div className="tr-gl" />
                    <div className="tr-gr" />
                    <div className="tr-shine">
                      <i />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tr-spot" aria-hidden="true" />

      <aside className={`tr-panel ${phase === "revealed" && view ? "is-open" : ""}`} aria-label="About your person">
        {view && (
          <>
            <section>
              <h2>About {firstName}</h2>
              {view.receiver.bio ? <p>{view.receiver.bio}</p> : <p className="tr-muted">No bio yet.</p>}
            </section>
          </>
        )}
      </aside>

      <canvas className="tr-fx" aria-hidden="true" />

      <div className={`tr-controls ${phase === "drawing" ? "is-hidden" : ""}`}>
        {note && (
          <p className={`tr-note ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}>
            {note}
          </p>
        )}
        <button
          type="button"
          className="tr-prompt"
          disabled={phase === "drawing"}
          onClick={() => handleRef.current?.draw()}
          aria-label={phase === "revealed" ? "Replay the Reveal animation" : "Reveal your person"}
        >
          <span className="tr-prompt-line" />
          <Sparkle />
          <span className="tr-prompt-text">{promptText}</span>
          <Sparkle />
          <span className="tr-prompt-line is-right" />
        </button>
      </div>

      <p className="tr-sr" aria-live="polite">
        {phase === "revealed" && view ? `You're the Secret Santa for ${view.receiver.name}.` : announcement}
      </p>
    </div>
  );
}
