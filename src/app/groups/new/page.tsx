import { ActionForm } from "@/components/action-form";
import { Button, Card, Page } from "@/components/ui";
import { requireUser } from "@/server/session";
import { createGroupAction } from "../actions";
import { SettingsFields } from "../settings-fields";

export default async function NewGroupPage() {
  await requireUser("/groups/new");
  return (
    <Page narrow title="New Group" subtitle="Give it a name, a budget and a gift day. You can change all of this later in Settings.">
      <Card>
        <ActionForm action={createGroupAction} className="space-y-4">
          <SettingsFields />
          <Button type="submit">Create Group</Button>
        </ActionForm>
      </Card>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
