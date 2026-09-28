import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Admin-only access to identity document images. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const file = await prisma.kycFile.findUnique({ where: { id: (await params).id } });
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(file.data), {
    headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store" },
  });
}
