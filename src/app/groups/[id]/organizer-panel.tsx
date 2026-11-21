import { ActionForm } from "@/components/action-form";
import { PictureUpload } from "@/components/picture-upload";
import { Button, Card, Field, Notice } from "@/components/ui";
import type { GroupView } from "@/server/groups";
import {
  addExclusionAction,
  clearOverridePictureAction,
  uploadOverridePictureAction,
  deleteGroupAction,
  drawAction,
  removeExclusionAction,
  removeMemberAction,
  resetInviteAction,
  setBioHiddenAction,
  setJoiningAction,
  setParticipatesAction,
  transferAction,
  updateSettingsAction,
} from "../actions";
import { SettingsFields } from "../settings-fields";
import { CopyButton } from "./copy-button";

const selectClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";

export function OrganizerPanel({
  group: g,
  meId,
  inviteUrl,
}: {
  group: GroupView;
  meId: string;
  inviteUrl: string;
}) {
  const id = g.id;
  const nameOf = (userId: string) => g.members.find((m) => m.userId === userId)?.name ?? "?";
  const others = g.members.filter((m) => m.userId !== meId);
  const me = g.members.find((m) => m.userId === meId);
  const participants = g.members.filter((m) => m.participates).length;

  if (g.archived) {
    return <DeleteCard g={g} />;
  }

  return (
    <>
      <h2 className="pt-2 text-lg font-semibold">Organizer</h2>

      {g.needsRedraw && (
        <Notice tone="error">
          A Member left and closing the gap would break an Exclusion. Someone has no person until you Re-draw.
        </Notice>
      )}

      <Card className="space-y-3">
        <h3 className="font-medium">Invite link</h3>
        {g.status === "open" ? (
          <>
            <p className="break-all rounded bg-neutral-100 px-2 py-1 font-mono text-sm dark:bg-neutral-800">{inviteUrl}</p>
            <p className="text-sm">
              Code: <span className="font-mono">{g.inviteCode}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={inviteUrl} />
              <ActionForm action={resetInviteAction.bind(null, id)} confirm="Make a new link? The current one will stop working.">
                <Button type="submit" variant="secondary">Reset link</Button>
              </ActionForm>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">Joining is closed, so the invite link doesn&apos;t work.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-medium">Draw</h3>
        {g.status === "open" && (
          <>
            <p className="text-sm">Close joining when everyone is in. You can add Exclusions, then run the Draw.</p>
            <ActionForm action={setJoiningAction.bind(null, id, false)} confirm="Close joining? New people won't be able to join.">
              <Button type="submit">Close joining</Button>
            </ActionForm>
          </>
        )}
        {g.status === "joining_closed" && (
          <>
            <p className="text-sm">
              {participants} participating. A Draw needs at least 3 and an Exchange Date.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={drawAction.bind(null, id)} confirm="Run the Draw now? Everyone will be emailed.">
                <Button type="submit">Run the Draw</Button>
              </ActionForm>
              <ActionForm action={setJoiningAction.bind(null, id, true)}>
                <Button type="submit" variant="secondary">Reopen joining</Button>
              </ActionForm>
            </div>
          </>
        )}
        {g.status === "drawn" && (
          <ActionForm
            action={drawAction.bind(null, id)}
            confirm="Re-draw? Everyone gets a new person and is emailed. This replaces the current Draw."
          >
            <Button type="submit" variant={g.needsRedraw ? "primary" : "secondary"}>Re-draw</Button>
          </ActionForm>
        )}
        {g.status !== "drawn" && me && (
          <ActionForm action={setParticipatesAction.bind(null, id, !me.participates)}>
            <Button type="submit" variant="secondary">
              {me.participates ? "I won't give or receive (opt out)" : "Include me in the Draw"}
            </Button>
          </ActionForm>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-medium">Exclusions</h3>
        <p className="text-sm text-neutral-500">Pairs who can&apos;t be each other&apos;s Santa, e.g. couples.</p>
        {g.exclusions && g.exclusions.length > 0 && (
          <ul className="space-y-2">
            {g.exclusions.map(([a, b]) => (
              <li key={`${a}-${b}`} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {nameOf(a)} ↔ {nameOf(b)}
                </span>
                <ActionForm action={removeExclusionAction.bind(null, id, a, b)} className="">
                  <Button type="submit" variant="secondary">Remove</Button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        {g.members.length >= 2 && (
          <ActionForm action={addExclusionAction.bind(null, id)}>
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((field) => (
                <select key={field} name={field} required className={selectClass} defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {g.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              ))}
            </div>
            <Button type="submit" variant="secondary">Add Exclusion</Button>
          </ActionForm>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-medium">Settings</h3>
        <ActionForm action={updateSettingsAction.bind(null, id)} className="space-y-4">
          <SettingsFields initial={g} />
          <Button type="submit">Save</Button>
        </ActionForm>
      </Card>

      {others.length > 0 && (
        <Card className="space-y-3">
          <h3 className="font-medium">Members</h3>
          <ul className="space-y-3">
            {others.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.name}</span>
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={setBioHiddenAction.bind(null, id, m.userId, !m.bioHidden)} className="">
                    <Button type="submit" variant="secondary">{m.bioHidden ? "Show bio" : "Hide bio"}</Button>
                  </ActionForm>
                  {m.hasPictureOverride && (
                    <ActionForm action={clearOverridePictureAction.bind(null, id, m.userId)} className="">
                      <Button type="submit" variant="secondary">Restore picture</Button>
                    </ActionForm>
                  )}
                  <ActionForm
                    action={removeMemberAction.bind(null, id, m.userId)}
                    confirm={`Remove ${m.name} from ${g.name}?`}
                    className=""
                  >
                    <Button type="submit" variant="secondary">Remove</Button>
                  </ActionForm>
                </div>
                <div className="w-full">
                  <PictureUpload
                    upload={uploadOverridePictureAction.bind(null, id, m.userId)}
                    label="Replace picture in this Group"
                  />
                </div>
              </li>
            ))}
          </ul>
          <ActionForm action={transferAction.bind(null, id)} confirm="Make this person the Organizer? You'll lose Organizer controls.">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Transfer ownership to</span>
              <select name="to" required className={selectClass} defaultValue="">
                <option value="" disabled>Choose…</option>
                {others.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">Transfer</Button>
          </ActionForm>
        </Card>
      )}

      <DeleteCard g={g} />
    </>
  );
}

function DeleteCard({ g }: { g: GroupView }) {
  return (
    <Card className="space-y-3">
      <h3 className="font-medium">Delete Group</h3>
      <ActionForm action={deleteGroupAction.bind(null, g.id)} confirm="Delete this Group for everyone? This can't be undone.">
        <Field label={`Type "${g.name}" to confirm`} name="confirmName" required autoComplete="off" />
        <Button type="submit" variant="danger">Delete Group</Button>
      </ActionForm>
    </Card>
  );
}
