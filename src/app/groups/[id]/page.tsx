import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Avatar, Banner, Button, Card, CardTitle, Page, Pill, Sparkle, buttonClass } from "@/components/ui";
import { db } from "@/db";
import { appUrl } from "@/lib/env";
import { countdown, daysUntil, formatDay } from "@/lib/format";
import { isDomainError } from "@/server/errors";
import { getGroupView, myRevealState, type GroupView } from "@/server/groups";
import { requireUser } from "@/server/session";
import { leaveAction } from "../actions";
import { OrganizerPanel } from "./organizer-panel";

function budgetText(g: GroupView): string {
  if (g.budgetMin && g.budgetMax) return `${g.currency} ${g.budgetMin}–${g.budgetMax}`;
  if (g.budgetMax) return `Up to ${g.currency} ${g.budgetMax}`;
  if (g.budgetMin) return `From ${g.currency} ${g.budgetMin}`;
  return "Not set";
}

/** Where the Group is in its life: Joining → Ready to draw → Drawn → Gift day. */
function Progress({ g }: { g: GroupView }) {
  const giftDayPassed = g.exchangeDate ? daysUntil(g.exchangeDate) < 0 : false;
  const current = g.archived || giftDayPassed ? 3 : g.status === "open" ? 0 : g.status === "joining_closed" ? 1 : 2;
  const steps = ["Joining", "Ready to draw", "Drawn", "Gift day"];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Group progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-px flex-1 ${i === 0 ? "opacity-0" : done || active ? "bg-sand-lt" : "bg-cream/20"}`} />
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-title text-sm ${
                  active
                    ? "border-sand bg-sand text-ink shadow-[0_0_18px_rgba(236,217,178,0.55)]"
                    : done
                      ? "border-sand-lt bg-transparent text-sand-lt"
                      : "border-cream/25 text-cream/40"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : done ? "bg-sand-lt" : "bg-cream/20"}`} />
            </div>
            <span
              className={`font-title text-[10px] tracking-[0.16em] uppercase sm:text-xs ${
                active ? "text-cream" : done ? "text-sand-lt/80" : "text-cream/40"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/groups/${id}`);

  let g: GroupView;
  try {
    g = await getGroupView(db, me.id, id);
  } catch (e) {
    if (isDomainError(e) && e.code === "not-found") notFound();
    throw e;
  }
  const reveal = g.status === "drawn" ? await myRevealState(db, me.id, id) : null;
  const self = g.members.find((m) => m.userId === me.id);
  const when = countdown(g.exchangeDate);
  const organizer = g.members.find((m) => m.isOrganizer);

  return (
    <Page
      title={g.name}
      subtitle={
        <>
          Budget <strong className="font-medium text-cream">{budgetText(g)}</strong>
          {" · "}
          {g.exchangeDate ? (
            <>
              Gift day <strong className="font-medium text-cream">{formatDay(g.exchangeDate)}</strong>
              {when && ` (${when})`}
            </>
          ) : (
            "Gift day not set yet"
          )}
        </>
      }
    >
      {g.archived && <Banner>This Group is archived and read-only.</Banner>}

      <Progress g={g} />

      {/* Your next step: the one thing to do right now. */}
      {reveal?.hasAssignment && (
        <section className="relative overflow-hidden rounded-lg border border-sand-lt/40 bg-gradient-to-br from-ink/80 to-night-2/90 p-6 text-center shadow-[0_20px_60px_rgba(10,8,40,0.6)] sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,246,226,0.22),transparent_60%)]"
          />
          <div className="relative">
            <p className="font-title text-xs tracking-[0.34em] text-sand-lt uppercase">
              {reveal.revealed ? "You've revealed your person" : "The Draw is done"}
            </p>
            <h2 className="mt-2 font-title text-2xl font-medium tracking-[0.14em] uppercase sm:text-3xl">
              {reveal.revealed ? "Want another look?" : "Your person is waiting"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-cream/75">
              {reveal.revealed
                ? "Replay the cards any time to see their bio and song."
                : "Draw your card to find out who you're gifting. Make sure nobody is looking at your screen."}
            </p>
            <Link href={`/groups/${id}/reveal`} className={`mt-5 ${buttonClass("primary", { size: "lg" })}`}>
              <Sparkle twinkle />
              {reveal.revealed ? "See my person" : "Reveal my person"}
              <Sparkle twinkle />
            </Link>
          </div>
        </section>
      )}
      {reveal && !reveal.hasAssignment && (
        <Banner>
          {g.needsRedraw
            ? "Your person changed and the Organizer needs to run a Re-draw. Check back here soon."
            : "You're not part of this Draw."}
        </Banner>
      )}
      {!reveal && !g.isOrganizer && !g.archived && (
        <Banner>
          {g.status === "open"
            ? `You're in! ${organizer?.name ?? "The Organizer"} will close joining once everyone has joined, then run the Draw.`
            : `Everyone's in. ${organizer?.name ?? "The Organizer"} will run the Draw soon; come back here to reveal your person.`}
        </Banner>
      )}

      {self?.hasPictureOverride && <Banner>The Organizer changed your picture in this Group.</Banner>}
      {self?.bioHidden && <Banner>The Organizer hid your bio in this Group.</Banner>}

      {/* Laptop-first: two columns; stacks to one column on small screens. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardTitle hint={g.status === "drawn" && g.isOrganizer ? "You can see who has revealed, never who drew whom." : undefined}>
            Members · {g.members.length}
          </CardTitle>
          <ul className="divide-y divide-ink/10">
            {g.members.map((m) => (
              <li key={m.userId} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                <Avatar name={m.name} image={m.image} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {m.name}
                      {m.userId === me.id && <span className="text-muted"> (you)</span>}
                    </span>
                    {m.isOrganizer && <Pill tone="ink">Organizer</Pill>}
                    {!m.participates && <Pill tone="muted">Not drawing</Pill>}
                    {m.revealed !== undefined && (
                      <Pill tone={m.revealed ? "pine" : "muted"}>{m.revealed ? "Revealed" : "Not revealed"}</Pill>
                    )}
                  </div>
                  {m.bio && <p className="mt-0.5 text-sm break-words text-muted">{m.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          {g.isOrganizer ? (
            <OrganizerPanel group={g} meId={me.id} inviteUrl={`${appUrl()}/join/${g.inviteCode}`} />
          ) : (
            <Card>
              <CardTitle hint={g.status === "drawn" ? "If you leave, your Santa is given a new person." : undefined}>
                Leave this Group
              </CardTitle>
              <ActionForm
                action={leaveAction.bind(null, id)}
                confirm={{ title: `Leave ${g.name}?`, body: g.status === "drawn" ? "Your Santa will be given a new person, and you won't be gifting anyone here." : "You can rejoin with the invite link while joining is open.", confirmLabel: "Leave Group", tone: "danger" }}
              >
                <Button type="submit" variant="secondary">
                  Leave Group
                </Button>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
