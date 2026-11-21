import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PictureUpload } from "@/components/picture-upload";
import { Button, Card, Field, Notice } from "@/components/ui";
import type { GroupView } from "@/server/groups";
import {
  addExclusionAction,
  clearOverridePictureAction,
  deleteGroupAction,
  drawAction,
  removeExclusionAction,
  removeMemberAction,
  resetInviteAction,
  resetMemberPasswordAction,
  setBioHiddenAction,
  setJoiningAction,
  setParticipatesAction,
  transferAction,
  updateSettingsAction,
  uploadOverridePictureAction,
} from "../actions";
import { SettingsFields } from "../settings-fields";
import { CopyButton } from "./copy-button";

const selectClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700";

/**
 * Organizer-only cards. The Group page shows Invite + Draw and a Settings
 * button; /groups/[id]/settings holds every other config; the Invite card
 * is also the step shown right after creating a Group.
 */

/** On the Group page: Invite, Draw, and the way into Settings. */
export function OrganizerPanel({ group: g, meId, inviteUrl }: { group: GroupView; meId: string; inviteUrl: string }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Organizer</h2>
        <Link
          href={`/groups/${g.id}/settings`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          ⚙ Settings
        </Link>
      </div>
      {g.archived ? (
        <Notice>This Group is archived. Use Settings to delete it.</Notice>
      ) : (
        <>
          {g.needsRedraw && (
            <Notice tone="error">
              A Member left and closing the gap would break an Exclusion. Someone has no person until you Re-draw.
            </Notice>
          )}
          <InviteCard group={g} inviteUrl={inviteUrl} />
          <DrawCard group={g} meId={meId} />
        </>
      )}
    </>
  );
}

export function InviteCard({ group: g, inviteUrl }: { group: GroupView; inviteUrl: string }) {
  const id = g.id;
  return (
    <Card className="space-y-3">
      <h3 className="font-medium">Invite people</h3>
      {g.status === "open" ? (
        <>
          <p className="break-all rounded bg-neutral-100 px-2 py-1 font-mono text-sm dark:bg-neutral-800">{inviteUrl}</p>
          <p className="text-sm">
            Group code: <span className="font-mono text-base font-semibold tracking-wider">{g.inviteCode}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={inviteUrl} />
            <ActionForm action={resetInviteAction.bind(null, id)} confirm="Make a new link? The current one will stop working.">
              <Button type="submit" variant="secondary">Reset link</Button>
            </ActionForm>
          </div>
          <p className="text-xs text-neutral-500">
            Send the link or code to your friends (e.g. on WhatsApp). They create an account with a username and
            password, then join.
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          Joining is closed, so the invite link doesn&apos;t work. Reopen it in Settings.
        </p>
      )}
    </Card>
  );
}

/** Shown on both the Group page and Settings. */
function DrawCard({ group: g, meId }: { group: GroupView; meId: string }) {
  const id = g.id;
  const participants = g.members.filter((m) => m.participates).length;
  const me = g.members.find((m) => m.userId === meId);
  return (
    <Card className="space-y-3">
      <h3 className="font-medium">Draw</h3>
      {g.status === "open" && (
        <>
          <p className="text-sm">Close joining when everyone is in, add any Exclusions, then run the Draw.</p>
          <ActionForm action={setJoiningAction.bind(null, id, false)} confirm="Close joining? New people won't be able to join.">
            <Button type="submit">Close joining</Button>
          </ActionForm>
        </>
      )}
      {g.status === "joining_closed" && (
        <>
          <p className="text-sm">{participants} participating. A Draw needs at least 3 and an Exchange Date.</p>
          <ActionForm action={drawAction.bind(null, id)} confirm="Run the Draw now? Everyone can then reveal their person.">
            <Button type="submit">Run the Draw</Button>
          </ActionForm>
        </>
      )}
      {g.status === "drawn" && (
        <ActionForm
          action={drawAction.bind(null, id)}
          confirm="Re-draw? Everyone gets a new person. This replaces the current Draw."
        >
          <Button type="submit" variant={g.needsRedraw ? "primary" : "secondary"}>Re-draw</Button>
        </ActionForm>
      )}
      {g.status !== "drawn" && me && !me.participates && (
        <p className="text-xs text-neutral-500">You&apos;ve opted out of giving and receiving (change in Settings).</p>
      )}
    </Card>
  );
}

/** Everything on /groups/[id]/settings. */
export function SettingsSections({ group: g, meId }: { group: GroupView; meId: string }) {
  if (g.archived) return <DeleteCard g={g} />;
  const id = g.id;
  const nameOf = (userId: string) => g.members.find((m) => m.userId === userId)?.name ?? "?";
  const others = g.members.filter((m) => m.userId !== meId);
  const me = g.members.find((m) => m.userId === meId);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {g.needsRedraw && (
          <Notice tone="error">
            A Member left and closing the gap would break an Exclusion. Someone has no person until you Re-draw.
          </Notice>
        )}
        <DrawCard group={g} meId={meId} />

        <Card className="space-y-3">
          <h3 className="font-medium">Group details</h3>
          <ActionForm action={updateSettingsAction.bind(null, id)} className="space-y-4">
            <SettingsFields initial={g} />
            <Button type="submit">Save</Button>
          </ActionForm>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-medium">Joining &amp; participation</h3>
          {g.status === "drawn" ? (
            <p className="text-sm text-neutral-500">The Draw has happened, so joining and participation are fixed.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Closing joining lives in the Draw card above; reopening lives here. */}
              {g.status === "joining_closed" && (
                <ActionForm action={setJoiningAction.bind(null, id, true)} className="">
                  <Button type="submit" variant="secondary">Reopen joining</Button>
                </ActionForm>
              )}
              {me && (
                <ActionForm action={setParticipatesAction.bind(null, id, !me.participates)} className="">
                  <Button type="submit" variant="secondary">
                    {me.participates ? "I won't give or receive (opt out)" : "Include me in the Draw"}
                  </Button>
                </ActionForm>
              )}
            </div>
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
          {g.members.length >= 2 ? (
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
          ) : (
            <p className="text-sm text-neutral-500">Invite people first.</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="space-y-3">
          <h3 className="font-medium">Members</h3>
          {others.length === 0 ? (
            <p className="text-sm text-neutral-500">No one else has joined yet.</p>
          ) : (
            <ul className="space-y-4">
              {others.map((m) => (
                <li key={m.userId} className="space-y-2 border-b border-neutral-200 pb-3 last:border-0 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                  </div>
                  <PictureUpload upload={uploadOverridePictureAction.bind(null, id, m.userId)} label="Replace picture in this Group" />
                  <ActionForm
                    action={resetMemberPasswordAction.bind(null, id, m.userId)}
                    confirm={`Set a new password for ${m.name}? They'll be signed out everywhere.`}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="min-w-48 flex-1">
                      <Field
                        label="Reset password (forgot theirs?)"
                        name="password"
                        type="text"
                        required
                        minLength={8}
                        autoComplete="off"
                        placeholder="New temporary password"
                      />
                    </div>
                    <Button type="submit" variant="secondary">Set password</Button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {others.length > 0 && (
          <Card className="space-y-3">
            <h3 className="font-medium">Transfer ownership</h3>
            <ActionForm action={transferAction.bind(null, id)} confirm="Make this person the Organizer? You'll lose Organizer controls.">
              <select name="to" required className={selectClass} defaultValue="">
                <option value="" disabled>Choose…</option>
                {others.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary">Transfer</Button>
            </ActionForm>
          </Card>
        )}

        <DeleteCard g={g} />
      </div>
    </div>
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
