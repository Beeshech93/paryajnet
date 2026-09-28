/** Identity document validation. Pure functions, unit-tested in rules.test.ts. */

export const DOCUMENT_TYPES = ["CPF", "CURP", "PASSPORT"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function normalizeDocument(type: DocumentType, raw: string): string {
  const v = raw.trim().toUpperCase();
  return type === "CPF" ? v.replace(/\D/g, "") : v.replace(/\s/g, "");
}

/** Brazilian CPF: 11 digits with two mod-11 check digits. */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i] * (len + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== digits[len]) return false;
  }
  return true;
}

const CURP_RE =
  /^[A-Z][AEIOUX][A-Z]{2}(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}([A-Z\d])(\d)$/;
const CURP_CHARS = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

/** Mexican CURP: format, state code and check digit. */
export function isValidCurp(curp: string): boolean {
  const m = curp.match(CURP_RE);
  if (!m) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += CURP_CHARS.indexOf(curp[i]) * (18 - i);
  return (10 - (sum % 10)) % 10 === Number(curp[17]);
}

/** Birth date encoded in a CURP (position 17 tells the century: digit = 1900s, letter = 2000s). */
export function curpBirthDate(curp: string): string {
  const yy = Number(curp.slice(4, 6));
  const century = /\d/.test(curp[16]) ? 1900 : 2000;
  return `${century + yy}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
}

export function isValidPassport(v: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(v);
}

/** Returns an error code, or null when the document looks valid. */
export function validateDocument(type: DocumentType, number: string, birthDate: Date): string | null {
  if (type === "CPF") return isValidCpf(number) ? null : "invalid_cpf";
  if (type === "CURP") {
    if (!isValidCurp(number)) return "invalid_curp";
    return curpBirthDate(number) === birthDate.toISOString().slice(0, 10) ? null : "curp_birthdate_mismatch";
  }
  return isValidPassport(number) ? null : "invalid_document";
}

export const KYC_FILE_KINDS = ["DOCUMENT_FRONT", "DOCUMENT_BACK", "SELFIE"] as const;
export const KYC_MAX_FILE_BYTES = 3 * 1024 * 1024;
export const KYC_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
