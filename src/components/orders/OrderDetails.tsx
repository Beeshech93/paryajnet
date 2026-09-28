import { getLocale, getTranslations } from "next-intl/server";
import { LocalTime } from "@/components/LocalTime";
import { pickLabel } from "@/lib/labels";
import { formatMoney, formatOdds } from "@/lib/money";
import type { getOrderByCode } from "@/lib/orders";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderByCode>>>;

/** The picks of a sports service or the lines of a lottery ticket, with their results. */
export async function OrderDetails({ order }: { order: Order }) {
  const [locale, ts, tl] = await Promise.all([getLocale(), getTranslations("sports"), getTranslations("lottery")]);
  const tr = (k: string, v?: Record<string, string | number>) => ts(k, v);
  return (
    <div className="space-y-3">
      {order.bet?.legs.map((leg) => {
        const m = leg.selection.market;
        const e = m.event;
        return (
          <div key={leg.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <span
              className={`size-2 shrink-0 rounded-full ${leg.result === "WON" ? "bg-brand" : leg.result === "LOST" ? "bg-danger" : leg.result === "VOID" ? "bg-muted" : "bg-gold"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {pickLabel(tr, e, { type: m.type, line: m.line === null ? null : Number(m.line) }, leg.selection.code)}
              </p>
              <p className="truncate text-xs text-muted">
                {e.homeTeam} x {e.awayTeam} · <LocalTime value={e.startsAt} />
                {e.homeScore !== null && ` · ${e.homeScore}-${e.awayScore}`}
              </p>
            </div>
            <span className="font-bold tabular-nums">{formatOdds(leg.odds, locale)}</span>
          </div>
        );
      })}
      {order.ticket && (
        <>
          <p className="font-semibold">
            {order.ticket.draw.lottery
              ? `${tl(`lotteries.${order.ticket.draw.lottery}`)} · ${tl(`sessions.${order.ticket.draw.session}`)}`
              : order.ticket.draw.name}{" "}
            <span className="font-normal text-muted">
              · <LocalTime value={order.ticket.draw.drawAt ?? order.ticket.draw.closesAt} />
            </span>
          </p>
          {order.ticket.draw.first && (
            <p className="text-xs text-muted">
              P3 {order.ticket.draw.pick3 ?? order.ticket.draw.first} · P4{" "}
              {order.ticket.draw.pick4 ?? `${order.ticket.draw.second}${order.ticket.draw.third}`}
            </p>
          )}
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {order.ticket.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                <span className="w-20 text-xs text-muted">{tl(`types.${line.type}`)}</span>
                <span className="flex-1 font-display font-bold tracking-widest">{line.numbers}</span>
                <span className="text-xs tabular-nums">{formatMoney(line.stake, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
