import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/api-auth";
import { syncOdds, syncScores } from "@/lib/sports-sync";

export const maxDuration = 60;

/** Vercel Cron: refresh odds and results from The Odds API (intervals set in /admin/sports-data). */
export async function GET(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scores = await syncScores();
  const odds = await syncOdds();
  return NextResponse.json({ scores, odds });
}
