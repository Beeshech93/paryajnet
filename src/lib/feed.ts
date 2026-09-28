import { z } from "zod";
import { prisma } from "./db";
import { cancelEvent, createEvent, settleEvent, upsertMarkets } from "./sports";

/**
 * Odds-feed ingestion contract. An adapter for your data provider
 * (Sportradar, Betradar, Genius Sports, …) translates its messages into this
 * shape and POSTs them to /api/feed. Everything is idempotent by externalId.
 */
const selection = z.object({ code: z.string().min(1).max(10), odds: z.number().min(1.01).max(1000) });
const market = z.object({
  type: z.string(),
  line: z.number().nullable().optional(),
  status: z.enum(["OPEN", "SUSPENDED"]).optional(),
  selections: z.array(selection).min(2),
});
export const feedSchema = z.object({
  events: z
    .array(
      z.object({
        externalId: z.string().min(1).max(100),
        sport: z.enum(["football", "basketball"]),
        league: z.string().min(1).max(100),
        homeTeam: z.string().min(1).max(100),
        awayTeam: z.string().min(1).max(100),
        startsAt: z.coerce.date(),
        status: z.enum(["SCHEDULED", "LIVE", "FINISHED", "CANCELLED"]).optional(),
        clock: z.string().max(20).nullable().optional(),
        homeScore: z.number().int().min(0).optional(),
        awayScore: z.number().int().min(0).optional(),
        markets: z.array(market).optional(),
      }),
    )
    .max(500),
});

export type FeedPayload = z.infer<typeof feedSchema>;

export async function ingestFeed(payload: FeedPayload) {
  const results: { externalId: string; action: string; error?: string }[] = [];
  for (const e of payload.events) {
    try {
      const markets = (e.markets ?? []).map((m) => ({
        type: m.type,
        line: m.line ?? null,
        selections: m.selections,
        status: m.status,
      }));
      let event = await prisma.event.findUnique({ where: { externalId: e.externalId } });
      let action = "updated";
      if (!event) {
        event = await createEvent({ ...e, markets });
        action = "created";
      } else if (event.status === "SCHEDULED" || event.status === "LIVE") {
        await prisma.event.update({
          where: { id: event.id },
          data: { league: e.league, homeTeam: e.homeTeam, awayTeam: e.awayTeam, startsAt: e.startsAt },
        });
        await prisma.$transaction(async (tx) => {
          for (const m of markets) await upsertMarkets(tx, event!.id, [m], m.status);
        });
      }

      if (e.status === "LIVE" && event.status !== "SETTLED" && event.status !== "CANCELLED") {
        await prisma.event.update({
          where: { id: event.id },
          data: { status: "LIVE", clock: e.clock ?? null, homeScore: e.homeScore ?? 0, awayScore: e.awayScore ?? 0 },
        });
      } else if (e.status === "FINISHED" && (event.status === "SCHEDULED" || event.status === "LIVE")) {
        if (e.homeScore === undefined || e.awayScore === undefined)
          throw new Error("FINISHED requires homeScore and awayScore");
        await settleEvent(event.id, e.homeScore, e.awayScore);
        action = "settled";
      } else if (e.status === "CANCELLED" && (event.status === "SCHEDULED" || event.status === "LIVE")) {
        await cancelEvent(event.id);
        action = "cancelled";
      }
      results.push({ externalId: e.externalId, action });
    } catch (err) {
      results.push({
        externalId: e.externalId,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
