import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/ui";
import { SettingsSections } from "../organizer-panel";
import { loadForOrganizer } from "../organizer-page";

export default async function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadForOrganizer(id, `/groups/${id}/settings`);
  if ("redirectTo" in loaded) redirect(loaded.redirectTo);
  const { g, meId } = loaded;

  return (
    <Page title={`${g.name} · Settings`}>
      <Link href={`/groups/${id}`} className="text-sm underline">
        ← Back to {g.name}
      </Link>
      <SettingsSections group={g} meId={meId} />
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
