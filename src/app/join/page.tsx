import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, Page } from "@/components/ui";
import { goToJoinAction } from "../groups/actions";

export default function JoinWithCodePage() {
  return (
    <Page narrow title="Join a Group" subtitle="Enter the 8-character code your Organizer shared. Got a link instead? Just open it.">
      <Card>
        <ActionForm action={goToJoinAction} className="space-y-4">
          <Field label="Group code" name="code" required autoCapitalize="characters" autoComplete="off" placeholder="e.g. 4BDGHEQE" className="field-input font-title text-xl tracking-[0.22em] uppercase" />
          <Button type="submit">Continue</Button>
        </ActionForm>
      </Card>
    </Page>
  );
}
