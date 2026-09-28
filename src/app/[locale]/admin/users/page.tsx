import { getLocale, getTranslations } from "next-intl/server";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function AdminUsers() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin")]);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { wallets: true, _count: { select: { bets: true, tickets: true, casinoRounds: true } } },
  });
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="p-3">{t("users.user")}</th>
            <th className="p-3">{t("users.joined")}</th>
            <th className="p-3">{t("users.balances")}</th>
            <th className="p-3 text-right">{t("users.activity")}</th>
            <th className="p-3">{t("users.flags")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="p-3">
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-muted">{u.email}</p>
              </td>
              <td className="p-3 text-xs">
                <LocalTime value={u.createdAt} dateOnly />
              </td>
              <td className="p-3 tabular-nums">
                {u.wallets.map((w) => (
                  <p key={w.id}>{formatMoney(w.balance, w.currency, locale)}</p>
                ))}
              </td>
              <td className="p-3 text-right text-xs tabular-nums">
                {u._count.bets} / {u._count.tickets} / {u._count.casinoRounds}
              </td>
              <td className="p-3">
                {u.kycStatus === "VERIFIED" && <span className="chip mr-1 bg-brand/15 text-brand-strong">KYC ✓</span>}
                {u.kycStatus === "PENDING" && <span className="chip mr-1 bg-gold/15 text-gold-strong">KYC …</span>}
                {u.role === "ADMIN" && <span className="chip bg-danger/15 text-danger">ADMIN</span>}
                {u.selfExcludedUntil && u.selfExcludedUntil > new Date() && (
                  <span className="chip bg-gold/15 text-gold-strong">{t("users.excluded")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
