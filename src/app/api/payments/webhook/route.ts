import { NextResponse } from "next/server";
import { mockProvider } from "@/lib/payment-providers/mock";
import { applyWebhook } from "@/lib/payments";

/** POST /api/payments/webhook — generic HMAC-signed webhook (see mock provider), e.g. for a relay. */
export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = await mockProvider.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (!event) return NextResponse.json({ result: "ignored" });
  return NextResponse.json({ result: await applyWebhook(event) });
}
