import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { canViewPicture } from "@/server/picture-paths";
import { readPicture } from "@/server/pictures";

/**
 * Serves a private picture to a signed-in viewer who shares a Group with
 * its owner. File names are random and never reused, so caching is safe.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const key = (await ctx.params).path.join("/");
  if (!(await canViewPicture(db, session.user.id, key))) {
    return new NextResponse(null, { status: 404 });
  }
  const body = await readPicture(key);
  if (!body) return new NextResponse(null, { status: 404 });

  return new NextResponse(body instanceof ReadableStream ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
