import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Proof of payment sent by the customer over WhatsApp — admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const order = await prisma.order.findUnique({
    where: { id: (await params).id },
    select: { receipt: true, receiptMime: true },
  });
  if (!order?.receipt || !order.receiptMime) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(order.receipt), {
    headers: { "Content-Type": order.receiptMime, "Cache-Control": "private, no-store" },
  });
}
