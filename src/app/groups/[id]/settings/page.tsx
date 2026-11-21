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
    <Page backHref={`/groups/${id}`} title={`${g.name} · Settings`} subtitle="Everything about this Group, in one place.">
      <SettingsSections group={g} meId={meId} />
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
