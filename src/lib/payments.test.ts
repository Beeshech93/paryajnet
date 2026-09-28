import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { conektaProvider } from "./payment-providers/conekta";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.CONEKTA_WEBHOOK_PUBLIC_KEY = publicKey
  .export({ type: "spki", format: "pem" })
  .toString()
  .replace(/\n/g, "\\n");

function signed(body: object) {
  const raw = JSON.stringify(body);
  const digest = sign("sha256", Buffer.from(raw, "utf8"), privateKey).toString("base64");
  return { raw, headers: new Headers({ digest }) };
}

test("Conekta webhook: verified order.paid becomes PAID with the amount in pesos", async () => {
  const { raw, headers } = signed({ type: "order.paid", data: { object: { id: "ord_123", amount: 25050 } } });
  assert.deepEqual(await conektaProvider.parseWebhook(raw, headers), {
    providerRef: "ord_123",
    status: "PAID",
    amount: "250.50",
  });
});

test("Conekta webhook: expired orders fail, other events are ignored", async () => {
  const exp = signed({ type: "order.expired", data: { object: { id: "ord_9", amount: 100 } } });
  assert.deepEqual(await conektaProvider.parseWebhook(exp.raw, exp.headers), {
    providerRef: "ord_9",
    status: "FAILED",
  });
  const other = signed({ type: "customer.created", data: { object: { id: "cus_1", amount: 0 } } });
  assert.equal(await conektaProvider.parseWebhook(other.raw, other.headers), null);
});

test("Conekta webhook: tampered body or missing signature is rejected", async () => {
  const { headers } = signed({ type: "order.paid", data: { object: { id: "ord_1", amount: 100 } } });
  const tampered = JSON.stringify({ type: "order.paid", data: { object: { id: "ord_1", amount: 9999900 } } });
  await assert.rejects(conektaProvider.parseWebhook(tampered, headers));
  await assert.rejects(conektaProvider.parseWebhook(tampered, new Headers()));
});
