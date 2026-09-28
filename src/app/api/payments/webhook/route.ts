import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/payment-providers";
import { applyWebhook } from "@/lib/payments";

/** POST /api/payments/webhook — deposit confirmations from the active payment provider. */
export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = await activeProvider().parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (!event) return NextResponse.json({ result: "ignored" });
  return NextResponse.json({ result: await applyWebhook(event) });
}
