import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Banner images. The URL carries ?v=<updatedAt>, so responses can be cached for a long time. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const mobile = new URL(req.url).searchParams.get("variant") === "mobile";
  const b = await prisma.banner.findUnique({
    where: { id: (await params).id },
    select: { image: true, imageMime: true, mobileImage: true, mobileMime: true },
  });
  const data = mobile ? b?.mobileImage : b?.image;
  const mime = mobile ? b?.mobileMime : b?.imageMime;
  if (!data || !mime) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(data), {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
