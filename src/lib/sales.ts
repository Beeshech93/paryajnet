import { prisma } from "./db";
import { Decimal } from "./money";

export { startOfBrDay } from "./orders-rules";

const zero = new Decimal(0);

/**
 * Cash an agent handled since `from`: sales they made (cancelled ones excluded)
 * and winnings they paid out. The difference is what should be in their drawer.
 */
export async function cashSummary(userId: string | null, from?: Date) {
  const soldWhere = {
    channel: "AGENT",
    status: { not: "REJECTED" },
    ...(userId && { soldById: userId }),
    ...(from && { createdAt: { gte: from } }),
  };
  const paidWhere = {
    payoutKeyType: "CASH",
    status: "PAID",
    ...(userId && { paidById: userId }),
    ...(from && { paidAt: { gte: from } }),
  };
  const [sold, paid] = await Promise.all([
    prisma.order.aggregate({ where: soldWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: paidWhere, _sum: { payout: true }, _count: { _all: true } }),
  ]);
  const soldTotal = sold._sum.amount ?? zero;
  const paidTotal = paid._sum.payout ?? zero;
  return {
    sales: sold._count._all,
    sold: soldTotal,
    payouts: paid._count._all,
    paid: paidTotal,
    balance: soldTotal.minus(paidTotal),
  };
}
