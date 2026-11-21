import Link from "next/link";
import { Card, Page } from "@/components/ui";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { listMyGroups } from "@/server/groups";

const STATUS_LABEL = {
  open: "Joining open",
  joining_closed: "Joining closed",
  drawn: "Drawn",
} as const;

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <Page title="Secret Santa, sorted.">
        <p>
          Create a Group, share the invite link, and let the Draw pick who gives to whom.
          Nobody, not even the Organizer, sees the full list.
        </p>
        <div className="flex gap-3">
          <Link className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white" href="/sign-up">
            Create an account
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm font-medium" href="/sign-in">
            Sign in
          </Link>
        </div>
      </Page>
    );
  }

  const groups = await listMyGroups(db, session.user.id);

  return (
    <Page title="Your Groups">
      <div className="flex gap-3">
        <Link className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white" href="/groups/new">
          New Group
        </Link>
        <Link className="rounded-md border px-4 py-2 text-sm font-medium" href="/join">
          Join with a code
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="text-neutral-500">
          You&apos;re not in any Groups yet. Create one, or open an invite link someone sent you.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`}>
                <Card className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-sm text-neutral-500">
                    {g.archived ? "Archived" : STATUS_LABEL[g.status]}
                    {g.exchangeDate && ` · Exchange ${g.exchangeDate}`}
                    {g.isOrganizer && " · You organise this"}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
