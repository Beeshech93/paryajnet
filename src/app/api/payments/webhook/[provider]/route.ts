import { NextResponse } from "next/server";
import { providerByName } from "@/lib/payment-providers";
import { applyWebhook } from "@/lib/payments";

/** POST /api/payments/webhook/<provider> — deposit notifications from a specific provider. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = providerByName((await params).provider);
  if (!provider) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  const raw = await req.text();
  let event;
  try {
    event = await provider.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (!event) return NextResponse.json({ result: "ignored" });
  return NextResponse.json({ result: await applyWebhook(event, provider.name) });
}
