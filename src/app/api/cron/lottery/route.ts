import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/api-auth";
import { ensureUpcomingDraws } from "@/lib/lottery";

/** Vercel Cron: keep the next days of NY / FL / GA draws scheduled. Auth: `Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureUpcomingDraws();
  return NextResponse.json({ ok: true });
}
