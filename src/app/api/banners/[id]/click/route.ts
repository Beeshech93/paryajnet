import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Count the click, then send the visitor to the banner's link. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const banner = await prisma.banner.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!banner?.linkUrl) return NextResponse.redirect(new URL("/", req.url));
  await prisma.banner.update({ where: { id }, data: { clicks: { increment: 1 } } });
  return NextResponse.redirect(new URL(banner.linkUrl, req.url), 302);
}
