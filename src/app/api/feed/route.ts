import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/api-auth";
import { feedSchema, ingestFeed } from "@/lib/feed";

/** POST /api/feed — push events, odds, live scores and results. Auth: `Authorization: Bearer $FEED_API_KEY`. */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.FEED_API_KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = feedSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });
  return NextResponse.json({ results: await ingestFeed(parsed.data) });
}
