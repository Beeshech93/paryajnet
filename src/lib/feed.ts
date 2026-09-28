import { z } from "zod";
import { prisma } from "./db";
import { mapLimit } from "./concurrency";
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
  // A few events at a time: each one is a handful of queries against a remote database.
  return mapLimit(payload.events, 4, async (e): Promise<{ externalId: string; action: string; error?: string }> => {
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
        // Group by requested status so each group is one bulk upsert.
        for (const st of [undefined, "OPEN", "SUSPENDED"] as const) {
          const group = markets.filter((m) => m.status === st);
          if (group.length) await upsertMarkets(prisma, event!.id, group, st);
        }
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
      return { externalId: e.externalId, action };
    } catch (err) {
      return {
        externalId: e.externalId,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
