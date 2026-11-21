import Link from "next/link";
import { Card, Page, Pill, Sparkle, buttonClass } from "@/components/ui";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { countdown, formatDay } from "@/lib/format";
import { listMyGroups, type MyGroupSummary } from "@/server/groups";

/** One line per Group telling you what happens next. */
function nextStep(g: MyGroupSummary): { pill: string; tone: "sand" | "ink" | "pine" | "muted"; hint: string } {
  if (g.archived) return { pill: "Archived", tone: "muted", hint: "This exchange is over." };
  switch (g.status) {
    case "open":
      return {
        pill: "Joining open",
        tone: "sand",
        hint: g.isOrganizer ? "Share the invite link, then close joining." : "Waiting for everyone to join.",
      };
    case "joining_closed":
      return {
        pill: "Ready to draw",
        tone: "ink",
        hint: g.isOrganizer ? "Everyone's in. Run the Draw." : "The Organizer will run the Draw soon.",
      };
    case "drawn":
      return { pill: "Drawn", tone: "pine", hint: "Open it to reveal your person." };
  }
}

const STEPS = [
  { title: "Create a Group", text: "Set a budget and the exchange date." },
  { title: "Share the link", text: "Friends sign up with a username and join." },
  { title: "Draw & reveal", text: "Everyone gets one person. Nobody sees the full list." },
];

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <Page back={false} title="Secret Santa, sorted" subtitle="A Secret Santa for your friend group, drawn under the desert stars.">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title}>
              <div className="font-title text-3xl font-medium text-ink-soft">{i + 1}</div>
              <h2 className="mt-2 font-title text-lg font-medium tracking-[0.12em] uppercase">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonClass("primary", { size: "lg" })} href="/sign-up">
            Create an account
          </Link>
          <Link className={buttonClass("secondary", { size: "lg", onNight: true })} href="/sign-in">
            Sign in
          </Link>
        </div>
      </Page>
    );
  }

  const groups = await listMyGroups(db, session.user.id);
  const firstName = session.user.name.split(/\s+/)[0];

  return (
    <Page back={false} title="Your Groups" subtitle={`Welcome back, ${firstName}.`}>
      <div className="flex flex-wrap gap-3">
        <Link className={buttonClass("primary")} href="/groups/new">
          <span aria-hidden>＋</span> New Group
        </Link>
        <Link className={buttonClass("secondary", { onNight: true })} href="/join">
          Join with a code
        </Link>
      </div>

      {groups.length === 0 ? (
        <Card className="text-center">
          <Sparkle className="mx-auto h-7 w-5 text-ink-soft" twinkle />
          <h2 className="mt-3 font-title text-lg font-medium tracking-[0.12em] uppercase">No Groups yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Start one for your friends, or open the invite link someone sent you. Got a code instead? Use
            &ldquo;Join with a code&rdquo;.
          </p>
          <Link className={`mt-5 ${buttonClass("primary")}`} href="/groups/new">
            Create your first Group
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const step = nextStep(g);
            const when = countdown(g.exchangeDate);
            return (
              <li key={g.id}>
                <Link href={`/groups/${g.id}`} className="group block h-full rounded-md">
                  <Card className="flex h-full flex-col gap-3 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_22px_50px_rgba(15,10,45,0.5)]">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-title text-lg font-medium tracking-[0.08em] break-words uppercase">
                        {g.name}
                      </h2>
                      <Pill tone={step.tone}>{step.pill}</Pill>
                    </div>
                    <p className="text-sm text-ink">{step.hint}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/15 pt-3 text-xs text-muted">
                      <span>
                        {g.exchangeDate ? `Exchange ${formatDay(g.exchangeDate)}` : "No exchange date yet"}
                        {when && ` · ${when}`}
                      </span>
                      {g.isOrganizer && <span className="font-medium text-ink-soft">You organise this</span>}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
