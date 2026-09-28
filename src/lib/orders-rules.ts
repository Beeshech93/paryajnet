/** Pure helpers for services (orders) and the WhatsApp agent. Unit-tested in rules.test.ts. */
import { randomInt } from "node:crypto";
import { normalizePixKey, type PixKeyType } from "./pix";

/** Code alphabet without look-alikes (0/O, 1/I). */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newOrderCode(): string {
  return "PJ" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Find a service code (PJ + 6) anywhere in a message, tolerating spaces, dashes and lower case. */
export function findOrderCode(text: string): string | null {
  const m = text.toUpperCase().match(/\bPJ[\s-]?([2-9A-HJ-NP-Z]{6})\b/);
  return m ? `PJ${m[1]}` : null;
}

/**
 * Normalise a Brazilian WhatsApp number to digits with country code:
 * "(11) 98765-4321" → "5511987654321". Returns null when it can't be a BR mobile/landline.
 */
export function normalizeBrPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55[1-9]\d\d{8,9}$/.test(d) ? d : null;
}

export function formatPhone(digits: string): string {
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

export function maskPhone(digits: string): string {
  return digits.length > 4 ? `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : digits;
}

/**
 * Detect a PIX key in a free-text WhatsApp reply. Tries, in order: e-mail,
 * random key (UUID), CNPJ, CPF, phone. Returns null if nothing valid is found.
 */
export function detectPixKey(text: string): { type: PixKeyType; key: string } | null {
  const t = text.trim();
  const email = t.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (email) {
    const key = normalizePixKey("EMAIL", email[0].replace(/[.,;]+$/, ""));
    if (key) return { type: "EMAIL", key };
  }
  const uuid = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return { type: "EVP", key: uuid[0].toLowerCase() };
  const digits = t.replace(/[^\d+]/g, "");
  const plain = digits.replace(/\D/g, "");
  if (plain.length === 14) {
    const key = normalizePixKey("CNPJ", plain);
    if (key) return { type: "CNPJ", key };
  }
  if (plain.length === 11) {
    // 11 digits can be a CPF or a mobile number (DDD + 9 digits): the CPF check digits decide.
    const cpf = normalizePixKey("CPF", plain);
    if (cpf) return { type: "CPF", key: cpf };
  }
  const phone = normalizePixKey("PHONE", plain);
  if (phone) return { type: "PHONE", key: phone };
  return null;
}

export type IncomingMessage = {
  id: string;
  phone: string;
  name: string | null;
  text: string;
  media: { type: "IMAGE" | "DOCUMENT"; mimetype: string; base64: string | null } | null;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Read an Evolution API "messages.upsert" webhook payload. Returns null for
 * anything the agent should ignore: other events, our own messages, groups,
 * broadcasts and status updates.
 */
export function parseEvolutionMessage(payload: unknown): IncomingMessage | null {
  const p = obj(payload);
  const event = String(p.event ?? "")
    .toLowerCase()
    .replace("_", ".");
  if (event !== "messages.upsert") return null;
  const data = obj(p.data);
  const key = obj(data.key);
  if (key.fromMe === true) return null;
  const jid = str(key.remoteJid) ?? "";
  if (!jid.endsWith("@s.whatsapp.net")) return null; // groups (@g.us), status, broadcasts
  const phone = jid.split("@")[0].replace(/\D/g, "");
  const message = obj(data.message);
  const image = obj(message.imageMessage);
  const document = obj(message.documentMessage ?? obj(message.documentWithCaptionMessage).message);
  const doc = obj(document.documentMessage ?? document);
  const text =
    str(message.conversation) ??
    str(obj(message.extendedTextMessage).text) ??
    str(image.caption) ??
    str(doc.caption) ??
    "";
  let media: IncomingMessage["media"] = null;
  const base64 = str(message.base64) ?? str(data.base64);
  if (Object.keys(image).length) {
    media = { type: "IMAGE", mimetype: str(image.mimetype) ?? "image/jpeg", base64 };
  } else if (Object.keys(doc).length && str(doc.mimetype)) {
    media = { type: "DOCUMENT", mimetype: str(doc.mimetype)!, base64 };
  }
  if (!text && !media) return null;
  return { id: str(key.id) ?? "", phone, name: str(data.pushName), text, media };
}

// ---------- Cash sales by agents ----------

/** An agent can cancel their own cash sale this soon after selling it (e.g. a typing mistake). */
export const CANCEL_WINDOW_MINUTES = 10;

export function cancellable(
  order: { channel: string; status: string; soldById: string | null; createdAt: Date; payBy: Date },
  userId: string,
  now = new Date(),
) {
  return (
    order.channel === "AGENT" &&
    order.status === "CONFIRMED" &&
    order.soldById === userId &&
    now.getTime() - order.createdAt.getTime() <= CANCEL_WINDOW_MINUTES * 60_000 &&
    now < order.payBy
  );
}

/** Brazil (Brasília time) has no daylight saving: a day starts at 03:00 UTC. */
const BRT_OFFSET_MS = 3 * 3_600_000;

export function startOfBrDay(now = new Date()) {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BRT_OFFSET_MS);
}
