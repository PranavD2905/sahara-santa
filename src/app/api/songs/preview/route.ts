import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { lookupSong } from "@/lib/songs";

/** Fresh 30-second preview URL for a track. Signed-in users only. */
export async function GET(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const trackId = req.nextUrl.searchParams.get("trackId") ?? "";
  try {
    const song = await lookupSong(trackId);
    if (!song?.previewUrl) {
      return NextResponse.json({ error: "No preview available." }, { status: 404 });
    }
    return NextResponse.json({ previewUrl: song.previewUrl });
  } catch {
    return NextResponse.json({ error: "Music service unavailable." }, { status: 502 });
  }
}
