/**
 * PIX helpers (Brazil). Pure functions, unit-tested in rules.test.ts.
 * BR Code format: Banco Central do Brasil, "Manual de Padrões para Iniciação do Pix" (EMV-MPM).
 */
import { isValidCpf } from "./kyc-rules";

export const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const d = cnpj.split("").map(Number);
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * d[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === d[12] && check(13) === d[13];
}

/** Normalise a PIX key of the given type, or return null when it is not valid. */
export function normalizePixKey(type: string, raw: string): string | null {
  const v = raw.trim();
  switch (type) {
    case "CPF": {
      const digits = v.replace(/\D/g, "");
      return isValidCpf(digits) ? digits : null;
    }
    case "CNPJ": {
      const digits = v.replace(/\D/g, "");
      return isValidCnpj(digits) ? digits : null;
    }
    case "EMAIL": {
      const email = v.toLowerCase();
      return email.length <= 77 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    }
    case "PHONE": {
      let digits = v.replace(/\D/g, "");
      if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
      return /^55\d{10,11}$/.test(digits) ? `+${digits}` : null;
    }
    case "EVP": {
      const key = v.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key) ? key : null;
    }
    default:
      return null;
  }
}

/** Human-friendly display of a stored key. */
export function formatPixKey(type: string, key: string): string {
  if (type === "CPF" && key.length === 11)
    return `${key.slice(0, 3)}.${key.slice(3, 6)}.${key.slice(6, 9)}-${key.slice(9)}`;
  if (type === "CNPJ" && key.length === 14)
    return `${key.slice(0, 2)}.${key.slice(2, 5)}.${key.slice(5, 8)}/${key.slice(8, 12)}-${key.slice(12)}`;
  return key;
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), as required by the BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, "utf8")) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Letters, digits and spaces only, without accents (what banking apps accept). */
function clean(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, max);
}

/** Static PIX "copia e cola" payload with an optional fixed amount and a reference (txid). */
export function pixBrCode(opts: { key: string; name: string; city: string; amount?: string; txid?: string }): string {
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", opts.key);
  const txid = (opts.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const body =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (opts.amount ? tlv("54", opts.amount) : "") +
    tlv("58", "BR") +
    tlv("59", clean(opts.name, 25) || "RECEBEDOR") +
    tlv("60", clean(opts.city, 15) || "BRASIL") +
    tlv("62", tlv("05", txid)) +
    "6304";
  return body + crc16(body);
}
