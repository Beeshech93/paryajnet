import { NextResponse } from "next/server";
import { handleIncoming } from "@/lib/agent";
import { safeEqual } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { parseEvolutionMessage } from "@/lib/orders-rules";

/**
 * POST /api/whatsapp/webhook?token=… — Evolution API events (messages.upsert).
 * The token must match EVOLUTION_WEBHOOK_TOKEN; it is set by /admin/whatsapp.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (!expected || !safeEqual(token, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const msg = parseEvolutionMessage(payload);
  if (!msg) return NextResponse.json({ result: "ignored" });

  // Evolution may retry a delivery: handle each WhatsApp message id once.
  if (msg.id) {
    const seen = await prisma.whatsAppMessage.findFirst({
      where: { direction: "IN", error: `id:${msg.id}` },
      select: { id: true },
    });
    if (seen) return NextResponse.json({ result: "duplicate" });
    await prisma.whatsAppMessage.create({
      data: { phone: msg.phone, direction: "IN", status: "DEDUP", error: `id:${msg.id}` },
    });
  }
  try {
    await handleIncoming(msg);
  } catch (err) {
    console.error("[whatsapp] webhook handling failed", err);
    return NextResponse.json({ result: "error" }, { status: 500 });
  }
  return NextResponse.json({ result: "ok" });
}
