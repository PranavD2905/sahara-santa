import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Avatar, Button, Card, Notice, Page } from "@/components/ui";
import { db } from "@/db";
import { env } from "@/lib/env";
import { isDomainError } from "@/server/errors";
import { getGroupView, myRevealState, type GroupView } from "@/server/groups";
import { requireUser } from "@/server/session";
import { leaveAction } from "../actions";
import { OrganizerPanel } from "./organizer-panel";

function budgetText(g: GroupView): string {
  if (g.budgetMin && g.budgetMax) return `${g.currency} ${g.budgetMin}–${g.budgetMax}`;
  if (g.budgetMax) return `up to ${g.currency} ${g.budgetMax}`;
  if (g.budgetMin) return `from ${g.currency} ${g.budgetMin}`;
  return "Not set";
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

  return (
    <Page title={g.name}>
      {g.archived && <Notice>This Group is archived and read-only.</Notice>}

      <Card>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-neutral-500">Budget</dt>
          <dd>{budgetText(g)}</dd>
          <dt className="text-neutral-500">Exchange Date</dt>
          <dd>{g.exchangeDate ?? "Not set"}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            {g.status === "open" ? "Joining open" : g.status === "joining_closed" ? "Joining closed" : "Drawn"}
          </dd>
        </dl>
      </Card>

      {reveal && (
        <Card>
          {reveal.hasAssignment ? (
            <Link
              href={`/groups/${id}/reveal`}
              className="inline-block rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white"
            >
              {reveal.revealed ? "See my person" : "Reveal my person"}
            </Link>
          ) : g.needsRedraw ? (
            <Notice>Your person changed and the Organizer needs to run a Re-draw. You&apos;ll get an email.</Notice>
          ) : (
            <Notice>You&apos;re not part of this Draw.</Notice>
          )}
        </Card>
      )}

      {self?.hasPictureOverride && (
        <Notice>The Organizer changed your picture in this Group.</Notice>
      )}
      {self?.bioHidden && <Notice>The Organizer hid your bio in this Group.</Notice>}

      <Card>
        <h2 className="mb-3 font-medium">Members ({g.members.length})</h2>
        <ul className="space-y-3">
          {g.members.map((m) => (
            <li key={m.userId} className="flex items-start gap-3">
              <Avatar name={m.name} image={m.image} />
              <div className="min-w-0">
                <div className="font-medium">
                  {m.name}
                  {m.isOrganizer && <span className="ml-2 text-xs text-neutral-500">Organizer</span>}
                  {!m.participates && <span className="ml-2 text-xs text-neutral-500">not drawing</span>}
                  {m.revealed !== undefined && (
                    <span className="ml-2 text-xs text-neutral-500">
                      {m.revealed ? "revealed" : "not revealed yet"}
                    </span>
                  )}
                </div>
                {m.bio && <p className="break-words text-sm text-neutral-600 dark:text-neutral-400">{m.bio}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {g.isOrganizer ? (
        <OrganizerPanel group={g} meId={me.id} inviteUrl={`${env().BETTER_AUTH_URL}/join/${g.inviteCode}`} />
      ) : (
        <Card>
          <ActionForm
            action={leaveAction.bind(null, id)}
            confirm={`Leave ${g.name}?${g.status === "drawn" ? " Your Santa will be given a new person." : ""}`}
          >
            <Button type="submit" variant="secondary">
              Leave Group
            </Button>
          </ActionForm>
        </Card>
      )}
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
