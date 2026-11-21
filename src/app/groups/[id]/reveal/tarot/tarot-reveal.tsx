"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackButton } from "@/components/back-button";
import { SongPlayer } from "@/components/song-player";
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
    if (!root) return;
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
        if (p === "revealed") setHasRevealed(true);
      },
      onError: setError,
      onAnnounce: setAnnouncement,
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
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
            <section>
              <h2>Their song</h2>
              {view.receiver.song ? <SongPlayer song={view.receiver.song} /> : <p className="tr-muted">No song picked yet.</p>}
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
