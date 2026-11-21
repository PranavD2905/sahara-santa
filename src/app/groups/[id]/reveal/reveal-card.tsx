"use client";

import { useState, useTransition } from "react";
import { SongPlayer } from "@/components/song-player";
import { Avatar, Button, Card, Notice } from "@/components/ui";
import type { RevealView } from "@/server/groups";
import { revealAction } from "../../actions";

/** v1: deliberately basic. The reveal experience gets designed later. */
export function RevealButton({ groupId }: { groupId: string }) {
  const [view, setView] = useState<RevealView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (view) return <ReceiverCard view={view} />;

  return (
    <Card className="space-y-3 text-center">
      <p>Make sure nobody is looking at your screen.</p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const v = await revealAction(groupId);
            if (v) setView(v);
            else setError("There's no person for you right now.");
          })
        }
      >
        {pending ? "Revealing…" : "Reveal my person"}
      </Button>
      <Notice tone="error">{error}</Notice>
    </Card>
  );
}

export function ReceiverCard({ view }: { view: RevealView }) {
  const r = view.receiver;
  return (
    <Card className="space-y-4 text-center">
      <p className="text-sm text-neutral-500">You&apos;re the Secret Santa for</p>
      <div className="flex justify-center">
        <Avatar name={r.name} image={r.image} size={128} />
      </div>
      <p className="text-2xl font-semibold">{r.name}</p>
      {r.bio && <p className="break-words text-neutral-600 dark:text-neutral-400">{r.bio}</p>}
      {r.song ? <SongPlayer song={r.song} /> : <p className="text-sm text-neutral-500">No song picked yet.</p>}
    </Card>
  );
}
