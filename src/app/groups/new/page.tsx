import { ActionForm } from "@/components/action-form";
import { Button, Card, Page } from "@/components/ui";
import { requireUser } from "@/server/session";
import { createGroupAction } from "../actions";
import { SettingsFields } from "../settings-fields";

export default async function NewGroupPage() {
  await requireUser("/groups/new");
  return (
    <Page title="New Group">
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
