import { ActionForm } from "@/components/action-form";
import { PictureUpload } from "@/components/picture-upload";
import { Avatar, Button, Card, CardTitle, Field, Page } from "@/components/ui";
import { db } from "@/db";
import { BIO_MAX, getProfile, NAME_MAX, organizerPicture } from "@/server/profile";
import { requireUser, safeNext } from "@/server/session";
import { removePictureAction, saveProfileAction, uploadPictureAction } from "./actions";
import { DeleteAccount } from "./delete-account";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const me = await requireUser("/profile");
  const p = await getProfile(db, me.id);
  const { next } = await searchParams;
  const destination = next ? safeNext(next) : "/";
  const providedPicture = p.image ? null : await organizerPicture(db, me.id, destination);
  const hasPicture = Boolean(p.image || providedPicture);
  const incomplete = !p.bio?.trim() || !hasPicture;
  const returnTo = next ? destination : incomplete ? "/" : null;

  return (
    <Page
      narrow
      title={incomplete ? "Complete your profile" : "Your profile"}
      subtitle={incomplete
        ? "Add a profile picture and bio before you enter a Group. Both appear on your reveal card."
        : "This is what your friends see in your Groups, and what your Secret Santa sees on your card."}
    >
      <Card className="space-y-4">
        <CardTitle>Profile picture (required)</CardTitle>
        <p className="text-sm text-muted">
          {providedPicture
            ? "Your organizer supplied a group picture for your card. You can also upload your own profile picture."
            : "Your Secret Santa sees this picture on your card. Upload and save it before you continue."}
        </p>
        <div className="flex items-center gap-4">
          <Avatar name={p.name} image={p.image ?? providedPicture} size={96} />
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
          {returnTo && <input type="hidden" name="next" value={returnTo} />}
          <Field label="Display name" name="name" required maxLength={NAME_MAX} defaultValue={p.name} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Bio (required)</span>
            <textarea
              name="bio"
              required
              maxLength={BIO_MAX}
              rows={3}
              defaultValue={p.bio ?? ""}
              className="field-input"
            />
            <span className="block text-xs text-muted">Required to complete your profile. Up to {BIO_MAX} characters, shown to people in your Groups.</span>
          </label>
          <p className="text-sm text-muted">Username: {p.username ? `@${p.username}` : "—"} (used to sign in)</p>
          <Button type="submit" disabled={!hasPicture}>{returnTo ? "Save and continue" : "Save"}</Button>
        </ActionForm>
      </Card>


      <Card className="space-y-3">
        <CardTitle>Delete account</CardTitle>
        <DeleteAccount />
      </Card>
    </Page>
  );
}

// Per-user page: blocks on the session/URL by design (see Next "instant navigation").
export const instant = false;
