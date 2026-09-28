import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Deposit receipt: visible to the admin and to the player who uploaded it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
  const payment = await prisma.payment.findUnique({
    where: { id: (await params).id },
    select: { userId: true, receipt: true, receiptMime: true },
  });
  if (!payment?.receipt || !payment.receiptMime) return new NextResponse("Not found", { status: 404 });
  if (user.role !== "ADMIN" && payment.userId !== user.id) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(Buffer.from(payment.receipt), {
    headers: { "Content-Type": payment.receiptMime, "Cache-Control": "private, no-store" },
  });
}
