import { NextResponse } from "next/server";
import { z } from "zod";
import { bearerMatches } from "@/lib/api-auth";
import { ensureUpcomingDraws, findStateDraw, settleWithPicks } from "@/lib/lottery";
import { AppError } from "@/lib/types";

const schema = z.object({
  results: z
    .array(
      z.object({
        lottery: z.enum(["NY", "FL", "GA"]),
        session: z.enum(["MIDDAY", "EVENING", "NIGHT"]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Eastern Time calendar date
        pick3: z.string().regex(/^\d{3}$/),
        pick4: z.string().regex(/^\d{4}$/),
      }),
    )
    .max(50),
});

/**
 * POST /api/lottery/results — official Pick 3 / Pick 4 numbers for state draws.
 * Auth: `Authorization: Bearer $FEED_API_KEY`. Idempotent: settled draws are skipped.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.FEED_API_KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });

  const out = [];
  for (const r of parsed.data.results) {
    const draw = await findStateDraw(r.lottery, r.session, r.date);
    if (!draw) {
      out.push({ ...r, result: "not_found" });
      continue;
    }
    if (draw.status !== "OPEN") {
      out.push({ ...r, result: "already_settled" });
      continue;
    }
    try {
      await settleWithPicks(draw.id, r.pick3, r.pick4);
      out.push({ ...r, result: "settled" });
    } catch (err) {
      out.push({ ...r, result: err instanceof AppError ? err.code : "error" });
    }
  }
  await ensureUpcomingDraws();
  return NextResponse.json({ results: out });
}
