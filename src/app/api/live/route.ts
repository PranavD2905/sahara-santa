import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { isDomainError } from "@/server/errors";
import { liveRevision } from "@/server/live-updates";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in required." }, { status: 401, headers });
  const pathname = new URL(request.url).searchParams.get("path") ?? "/";
  try {
    return Response.json({ version: await liveRevision(db, session.user.id, pathname) }, { headers });
  } catch (error) {
    if (isDomainError(error) && error.code === "not-found") {
      return Response.json({ error: "Not found." }, { status: 404, headers });
    }
    throw error;
  }
}
