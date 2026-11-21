import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Page } from "@/components/ui";
import { goToJoinAction } from "../groups/actions";

export default function JoinWithCodePage() {
  return (
    <Page narrow title="Join a Group">
      <Card>
        <ActionForm action={goToJoinAction} className="space-y-4">
          <Field label="Invite code" name="code" required autoCapitalize="characters" autoComplete="off" />
          <Button type="submit">Continue</Button>
        </ActionForm>
      </Card>
    </Page>
  );
}
