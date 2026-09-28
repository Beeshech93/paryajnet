import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Impression beacon, sent once per banner when it becomes visible. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await prisma.banner.updateMany({ where: { id: (await params).id }, data: { views: { increment: 1 } } });
  return new NextResponse(null, { status: 204 });
}
