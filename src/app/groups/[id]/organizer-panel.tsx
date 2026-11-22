import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PictureUpload } from "@/components/picture-upload";
import type { ReactNode } from "react";
import { Banner, Button, Card, CardTitle, Field, Sparkle, buttonClass } from "@/components/ui";
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
        <h2 className="flex items-center gap-2 font-title text-lg font-medium tracking-[0.18em] text-cream uppercase">
          <Sparkle className="h-4 w-3 text-sand-lt" />
          You&apos;re the Organizer
        </h2>
        <Link href={`/groups/${g.id}/settings`} className={buttonClass("secondary", { onNight: true, size: "sm" })}>
          <span aria-hidden>⚙</span> Settings
        </Link>
      </div>
      {g.archived ? (
        <Banner>This Group is archived. Use Settings to delete it.</Banner>
      ) : (
        <>
          {g.needsRedraw && (
            <Banner tone="error">
              A Member left and closing the gap would break an Exclusion. Someone has no person until you Re-draw.
            </Banner>
          )}
          {/* The step that matters right now goes first. */}
          {g.status === "open" ? (
            <>
              <InviteCard group={g} inviteUrl={inviteUrl} />
              <DrawCard group={g} meId={meId} />
            </>
          ) : (
            <>
              <DrawCard group={g} meId={meId} />
              <InviteCard group={g} inviteUrl={inviteUrl} />
            </>
          )}
        </>
      )}
    </>
  );
}

export function InviteCard({ group: g, inviteUrl }: { group: GroupView; inviteUrl: string }) {
  const id = g.id;
  return (
    <Card className="space-y-4">
      <CardTitle hint={g.status === "open" ? "Send the link or code to your friends, e.g. on WhatsApp." : undefined}>
        Invite people
      </CardTitle>
      {g.status === "open" ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-dashed border-ink/40 bg-paper p-4">
            <div>
              <div className="font-title text-[10px] tracking-[0.24em] text-muted uppercase">Group code</div>
              <div className="font-title text-3xl font-medium tracking-[0.22em] text-ink">{g.inviteCode}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-title text-[10px] tracking-[0.24em] text-muted uppercase">Invite link</div>
              <div className="truncate font-mono text-sm text-ink" title={inviteUrl}>
                {inviteUrl}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={inviteUrl} />
            <ActionForm action={resetInviteAction.bind(null, id)} confirm={{ title: "Make a new invite link?", body: "The current link and code will stop working. Anyone who hasn't joined yet will need the new one.", confirmLabel: "Make new link" }}>
              <Button type="submit" variant="ghost" size="sm">Reset link</Button>
            </ActionForm>
          </div>
          <p className="text-xs text-muted">
            Friends open the link, create an account with a username and password, and tap Join.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          Joining is closed, so the invite link doesn&apos;t work right now. You can reopen it in Settings.
        </p>
      )}
    </Card>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-ink" : "text-muted"}`}>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
          ok ? "bg-pine text-cream" : "border-[1.5px] border-ink/30"
        }`}
        aria-hidden
      >
        {ok ? "✓" : ""}
      </span>
      {children}
    </li>
  );
}

/** Shown on both the Group page and Settings. */
function DrawCard({ group: g, meId }: { group: GroupView; meId: string }) {
  const id = g.id;
  const participants = g.members.filter((m) => m.participates).length;
  const me = g.members.find((m) => m.userId === meId);
  const enoughPeople = participants >= 3;
  const hasDate = Boolean(g.exchangeDate);
  const missingPictures = g.members.filter((m) => m.participates && !m.image?.trim());
  const hasPictures = missingPictures.length === 0;
  const pictureCheck = (
    <Check ok={hasPictures}>
      {hasPictures ? "Every participant has a picture" : `Picture needed: ${missingPictures.map((m) => m.name).join(", ")}. Ask them to upload one, or set a group picture in Settings.`}
    </Check>
  );
  return (
    <Card className="space-y-4">
      <CardTitle>The Draw</CardTitle>
      {g.status === "open" && (
        <>
          <p className="text-sm">When everyone has joined, close joining. Then you can add Exclusions and run the Draw.</p>
          <ul className="space-y-1.5">
            <Check ok={enoughPeople}>
              {participants} {participants === 1 ? "person" : "people"} in the Draw {enoughPeople ? "" : "(need at least 3)"}
            </Check>
            <Check ok={hasDate}>{hasDate ? "Gift day is set" : "Set a gift day in Settings"}</Check>
            {pictureCheck}
          </ul>
          <ActionForm action={setJoiningAction.bind(null, id, false)} confirm={{ title: "Close joining?", body: "Nobody new can join after this. You can still reopen joining from Settings until you run the Draw.", confirmLabel: "Close joining" }}>
            <Button type="submit">Close joining</Button>
          </ActionForm>
        </>
      )}
      {g.status === "joining_closed" && (
        <>
          <ul className="space-y-1.5">
            <Check ok={enoughPeople}>
              {participants} {participants === 1 ? "person" : "people"} in the Draw {enoughPeople ? "" : "(need at least 3)"}
            </Check>
            <Check ok={hasDate}>{hasDate ? "Gift day is set" : "Set a gift day in Settings"}</Check>
            {pictureCheck}
          </ul>
          <ActionForm action={drawAction.bind(null, id)} confirm={{ title: "Run the Draw?", body: "Everyone in the Draw gets one person to gift. They can reveal them straight away, so let the Group know!", confirmLabel: "Run the Draw" }}>
            <Button type="submit" size="lg" disabled={!enoughPeople || !hasDate || !hasPictures}>
              <Sparkle /> Run the Draw <Sparkle />
            </Button>
          </ActionForm>
          {(!enoughPeople || !hasDate || !hasPictures) && (
            <p className="text-xs text-muted">Finish the checklist above to unlock the Draw.</p>
          )}
        </>
      )}
      {g.status === "drawn" && (
        <>
          <p className="text-sm">
            Done! Tell everyone to open the Group and reveal their person. You&apos;ll see who has revealed in the
            member list.
          </p>
          <ActionForm
            action={drawAction.bind(null, id)}
            confirm={{ title: "Re-draw for everyone?", body: "Everyone gets a new person and has to reveal again. The current Draw is replaced and can't be restored.", confirmLabel: "Re-draw", tone: "danger" }}
          >
            <Button type="submit" variant={g.needsRedraw ? "primary" : "secondary"} size="sm" disabled={!hasPictures}>
              Re-draw
            </Button>
          </ActionForm>
          {!hasPictures && <ul>{pictureCheck}</ul>}
        </>
      )}
      {g.status !== "drawn" && me && !me.participates && (
        <p className="text-xs text-muted">You&apos;ve opted out of giving and receiving (change in Settings).</p>
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
          <Banner tone="error">
            A Member left and closing the gap would break an Exclusion. Someone has no person until you Re-draw.
          </Banner>
        )}
        <DrawCard group={g} meId={meId} />

        <Card className="space-y-3">
          <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Group details</h3>
          <ActionForm action={updateSettingsAction.bind(null, id)} className="space-y-4">
            <SettingsFields initial={g} />
            <Button type="submit">Save</Button>
          </ActionForm>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Joining &amp; participation</h3>
          {g.status === "drawn" ? (
            <p className="text-sm text-muted">The Draw has happened, so joining and participation are fixed.</p>
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
          <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Exclusions</h3>
          <p className="text-sm text-muted">Pairs who can&apos;t be each other&apos;s Santa, e.g. couples.</p>
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
                  <select key={field} name={field} required className="field-input" defaultValue="">
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
            <p className="text-sm text-muted">Invite people first.</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="space-y-3">
          <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Members</h3>
          {others.length === 0 ? (
            <p className="text-sm text-muted">No one else has joined yet.</p>
          ) : (
            <ul className="space-y-4">
              {others.map((m) => (
                <li key={m.userId} className="space-y-2 border-b border-ink/15 pb-3 last:border-0 ">
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
                        confirm={{ title: `Remove ${m.name}?`, body: g.status === "drawn" ? `${m.name} leaves ${g.name}. Their Santa is given a new person automatically.` : `${m.name} leaves ${g.name}. They can rejoin with the invite link while joining is open.`, confirmLabel: "Remove", tone: "danger" }}
                        className=""
                      >
                        <Button type="submit" variant="secondary">Remove</Button>
                      </ActionForm>
                    </div>
                  </div>
                  <PictureUpload upload={uploadOverridePictureAction.bind(null, id, m.userId)} label="Replace picture in this Group" />
                  <ActionForm
                    action={resetMemberPasswordAction.bind(null, id, m.userId)}
                    confirm={{ title: `Reset ${m.name}'s password?`, body: "They'll be signed out everywhere and need the new password to sign in. Tell it to them directly.", confirmLabel: "Set password" }}
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
            <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Transfer ownership</h3>
            <ActionForm action={transferAction.bind(null, id)} confirm={{ title: "Transfer ownership?", body: "They become the Organizer and you lose the Organizer controls. You stay in the Group as a Member.", confirmLabel: "Transfer", tone: "danger" }}>
              <select name="to" required className="field-input" defaultValue="">
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
      <h3 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">Delete Group</h3>
      <ActionForm action={deleteGroupAction.bind(null, g.id)} confirm={{ title: `Delete ${g.name}?`, body: "The Group, its members list and the Draw are deleted for everyone. This can't be undone.", confirmLabel: "Delete Group", tone: "danger" }}>
        <Field label={`Type "${g.name}" to confirm`} name="confirmName" required autoComplete="off" />
        <Button type="submit" variant="danger">Delete Group</Button>
      </ActionForm>
    </Card>
  );
}
