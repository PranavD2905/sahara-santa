import { ActionForm } from "@/components/action-form";
import { PictureUpload } from "@/components/picture-upload";
import { Avatar, Button, Card, Field, Page } from "@/components/ui";
import { db } from "@/db";
import { BIO_MAX, getProfile, NAME_MAX } from "@/server/profile";
import { requireUser } from "@/server/session";
import { removePictureAction, saveProfileAction, uploadPictureAction } from "./actions";
import { DeleteAccount } from "./delete-account";
import { SongPicker } from "./song-picker";

export default async function ProfilePage() {
  const me = await requireUser("/profile");
  const p = await getProfile(db, me.id);

  return (
    <Page narrow title="Your profile">
      <Card className="space-y-4">
        <h2 className="font-medium">Picture</h2>
        <div className="flex items-center gap-4">
          <Avatar name={p.name} image={p.image} size={96} />
          {p.image && (
            <ActionForm action={removePictureAction} className="">
              <Button type="submit" variant="secondary">Remove</Button>
            </ActionForm>
          )}
        </div>
        <PictureUpload upload={uploadPictureAction} label={p.image ? "Change picture" : "Choose picture"} />
      </Card>

      <Card>
        <ActionForm action={saveProfileAction} className="space-y-4">
          <Field label="Display name" name="name" required maxLength={NAME_MAX} defaultValue={p.name} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Bio</span>
            <textarea
              name="bio"
              maxLength={BIO_MAX}
              rows={3}
              defaultValue={p.bio ?? ""}
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700"
            />
            <span className="block text-xs text-neutral-500">Up to {BIO_MAX} characters. Shown to people in your Groups.</span>
          </label>
          <p className="text-sm text-neutral-500">Username: {p.username ? `@${p.username}` : "—"} (used to sign in)</p>
          <Button type="submit">Save</Button>
        </ActionForm>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Your song</h2>
        <p className="text-sm text-neutral-500">
          Hidden from everyone until the Draw. Then only your Secret Santa gets to hear it.
        </p>
        <SongPicker current={p.song} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">Delete account</h2>
        <DeleteAccount />
      </Card>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
