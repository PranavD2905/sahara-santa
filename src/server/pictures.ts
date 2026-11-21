import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { DomainError } from "./errors";
import { parsePicturePath, urlForPath } from "./picture-paths";

/**
 * Stores pictures in private Vercel Blob. Without BLOB_READ_WRITE_TOKEN
 * (local development) they go to ./.data/uploads instead.
 */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const SIZE = 512;
const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

// Vercel connects Blob either with a token or via OIDC (BLOB_STORE_ID); the
// SDK handles both. Neither set = local development.
const blobStorageEnabled = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

/**
 * Re-encodes to a 512×512 WebP. sharp drops EXIF/GPS metadata unless asked
 * to keep it; `.rotate()` first applies the EXIF orientation.
 */
async function normalise(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { limitInputPixels: 8192 * 8192 })
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new DomainError("invalid", "That file isn't an image we can read.");
  }
}

export async function readUpload(file: FormDataEntryValue | null): Promise<Buffer> {
  if (!(file instanceof File) || file.size === 0) {
    throw new DomainError("invalid", "Choose an image first.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError("invalid", "The cropped image is too large.");
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new DomainError("invalid", "Use a JPG, PNG, or WebP image.");
  }
  return Buffer.from(await file.arrayBuffer());
}

/** Saves a picture and returns its app URL (served by /api/pictures). */
export async function storePicture(
  owner: { userId: string; groupId?: string },
  input: Buffer,
): Promise<string> {
  const data = await normalise(input);
  const key = owner.groupId
    ? `overrides/${owner.groupId}/${owner.userId}/${nanoid()}.webp`
    : `profiles/${owner.userId}/${nanoid()}.webp`;
  if (!parsePicturePath(key)) throw new Error(`Unsafe picture path: ${key}`);

  if (blobStorageEnabled()) {
    await put(key, data, {
      access: "private",
      contentType: "image/webp",
      addRandomSuffix: false,
    });
  } else {
    const file = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
  return urlForPath(key);
}

export async function readPicture(key: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (!parsePicturePath(key)) return null;
  if (blobStorageEnabled()) {
    const result = await get(key, { access: "private" });
    return result?.statusCode === 200 ? result.stream : null;
  }
  try {
    return await readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}

/** Best effort: a leftover file is harmless, so failures are only logged. */
export async function deletePicture(key: string | null): Promise<void> {
  if (!key || !parsePicturePath(key)) return;
  try {
    if (blobStorageEnabled()) await del(key);
    else await rm(path.join(LOCAL_DIR, key), { force: true });
  } catch (e) {
    console.error("[pictures] delete failed:", key, e);
  }
}
