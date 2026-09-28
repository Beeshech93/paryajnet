import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Decimal, formatMoney } from "@/lib/money";
import { CURRENCIES } from "@/lib/types";

const zero = new Decimal(0);

export default async function AdminOverview() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin")]);

  const [users, pendingWithdrawals, pendingDeposits, openBets, pendingKyc] = await Promise.all([
    prisma.user.count(),
    prisma.payment.count({ where: { kind: "WITHDRAWAL", status: "PENDING" } }),
    prisma.payment.count({ where: { kind: "DEPOSIT", status: "PENDING" } }),
    prisma.bet.count({ where: { status: "OPEN" } }),
    prisma.kycSubmission.count({ where: { status: "PENDING" } }),
  ]);

  const rows = await Promise.all(
    CURRENCIES.map(async (currency) => {
      const [balances, deposits, withdrawals, sports, lottery, casino] = await Promise.all([
        prisma.wallet.aggregate({ where: { currency }, _sum: { balance: true } }),
        prisma.payment.aggregate({
          where: { wallet: { currency }, kind: "DEPOSIT", status: "COMPLETED" },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { wallet: { currency }, kind: "WITHDRAWAL", status: "COMPLETED" },
          _sum: { amount: true },
        }),
        prisma.bet.aggregate({ where: { currency, status: { not: "OPEN" } }, _sum: { stake: true, payout: true } }),
        prisma.lotteryTicket.aggregate({
          where: { currency, status: { not: "OPEN" } },
          _sum: { totalStake: true, payout: true },
        }),
        prisma.casinoRound.aggregate({ where: { currency }, _sum: { stake: true, payout: true } }),
      ]);
      const ggr = (stake: Decimal | null, payout: Decimal | null) => (stake ?? zero).sub(payout ?? zero);
      return {
        currency,
        balances: balances._sum.balance ?? zero,
        deposits: deposits._sum.amount ?? zero,
        withdrawals: withdrawals._sum.amount ?? zero,
        sports: ggr(sports._sum.stake, sports._sum.payout),
        lottery: ggr(lottery._sum.totalStake, lottery._sum.payout),
        casino: ggr(casino._sum.stake, casino._sum.payout),
      };
    }),
  );

  const kpis = [
    { label: t("kpi.users"), value: users },
    { label: t("kpi.openBets"), value: openBets },
    { label: t("kpi.pendingDeposits"), value: pendingDeposits },
    { label: t("kpi.pendingWithdrawals"), value: pendingWithdrawals, alert: pendingWithdrawals > 0 },
    { label: t("kpi.pendingKyc"), value: pendingKyc, alert: pendingKyc > 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("overview")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted">{k.label}</p>
            <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${k.alert ? "text-gold" : ""}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="p-3">{t("table.currency")}</th>
              <th className="p-3 text-right">{t("table.balances")}</th>
              <th className="p-3 text-right">{t("table.deposits")}</th>
              <th className="p-3 text-right">{t("table.withdrawals")}</th>
              <th className="p-3 text-right">{t("table.ggrSports")}</th>
              <th className="p-3 text-right">{t("table.ggrLottery")}</th>
              <th className="p-3 text-right">{t("table.ggrCasino")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.currency} className="border-b border-line last:border-0">
                <td className="p-3 font-bold">{r.currency}</td>
                {[r.balances, r.deposits, r.withdrawals, r.sports, r.lottery, r.casino].map((v, i) => (
                  <td key={i} className={`p-3 text-right ${i >= 3 && v.isNegative() ? "text-danger" : ""}`}>
                    {formatMoney(v, r.currency, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{t("ggrNote")}</p>
    </div>
  );
}
