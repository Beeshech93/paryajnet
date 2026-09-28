/**
 * US state lotteries used for borlette. Draw times are Eastern Time, from the
 * official schedules (NY Numbers/Win 4, FL Pick 3/Pick 4, GA Cash 3/Cash 4).
 * Pure functions: unit-tested in rules.test.ts.
 */
import type { DrawResult } from "./lottery-rules";

export const LOTTERY_TZ = "America/New_York";

export const LOTTERIES = {
  NY: { name: "New York", sessions: { MIDDAY: "14:30", EVENING: "22:30" } },
  FL: { name: "Florida", sessions: { MIDDAY: "13:30", EVENING: "21:45" } },
  GA: { name: "Georgia", sessions: { MIDDAY: "12:29", EVENING: "18:59", NIGHT: "23:34" } },
} as const;

export type LotteryCode = keyof typeof LOTTERIES;
export type SessionCode = "MIDDAY" | "EVENING" | "NIGHT";

export const LOTTERY_CODES = Object.keys(LOTTERIES) as LotteryCode[];

/** Betting closes this many minutes before the official draw. */
export const CUTOFF_MINUTES = Number(process.env.LOTTERY_CUTOFF_MINUTES ?? 10);

function tzOffsetMs(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}

/** Wall-clock time in a time zone ("2026-09-28", "14:30") → UTC instant. Handles DST. */
export function zonedToUtc(ymd: string, hm: string, tz = LOTTERY_TZ): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let result = guess - tzOffsetMs(new Date(guess), tz);
  result = guess - tzOffsetMs(new Date(result), tz); // second pass across DST changes
  return new Date(result);
}

/** Calendar date ("YYYY-MM-DD") of an instant in a time zone. */
export function zonedDate(date: Date, tz = LOTTERY_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type ScheduledDraw = { lottery: LotteryCode; session: SessionCode; drawAt: Date; closesAt: Date };

/** Every state draw from now until `days` calendar days ahead (Eastern Time). */
export function upcomingDraws(now: Date, days = 2): ScheduledDraw[] {
  const today = zonedDate(now);
  const out: ScheduledDraw[] = [];
  for (let i = 0; i <= days; i++) {
    const ymd = addDays(today, i);
    for (const lottery of LOTTERY_CODES) {
      for (const [session, hm] of Object.entries(LOTTERIES[lottery].sessions)) {
        const drawAt = zonedToUtc(ymd, hm);
        if (drawAt > now) {
          out.push({
            lottery,
            session: session as SessionCode,
            drawAt,
            closesAt: new Date(drawAt.getTime() - CUTOFF_MINUTES * 60_000),
          });
        }
      }
    }
  }
  return out.sort((a, b) => a.drawAt.getTime() - b.drawAt.getTime());
}

/** Borlette result from official numbers: 1st = Pick 3, 2nd/3rd = the two halves of Pick 4. */
export function resultFromPicks(pick3: string, pick4: string): DrawResult | null {
  if (!/^\d{3}$/.test(pick3) || !/^\d{4}$/.test(pick4)) return null;
  return { first: pick3, second: pick4.slice(0, 2), third: pick4.slice(2) };
}
