import { prisma } from "./db";
import {
  DOCUMENT_TYPES,
  KYC_FILE_KINDS,
  KYC_MAX_FILE_BYTES,
  KYC_MIME_TYPES,
  normalizeDocument,
  validateDocument,
  type DocumentType,
} from "./kyc-rules";
import { AppError } from "./types";

export type KycUpload = { kind: (typeof KYC_FILE_KINDS)[number]; file: File | null };

export async function submitKyc(
  userId: string,
  input: { fullName: string; documentType: string; documentNumber: string; files: KycUpload[] },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.kycStatus === "VERIFIED" || user.kycStatus === "PENDING") throw new AppError("kyc_already_submitted");
  if (!(DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) throw new AppError("invalid_document");
  const type = input.documentType as DocumentType;
  const number = normalizeDocument(type, input.documentNumber);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 5 || !fullName.includes(" ")) throw new AppError("invalid_full_name");

  const docError = validateDocument(type, number, user.birthDate);
  if (docError) throw new AppError(docError);

  // One account per person: the document can't belong to another player.
  const taken = await prisma.kycSubmission.findFirst({
    where: {
      documentType: type,
      documentNumber: number,
      userId: { not: userId },
      status: { in: ["PENDING", "VERIFIED"] },
    },
  });
  if (taken) throw new AppError("document_in_use");

  const files = [];
  for (const { kind, file } of input.files) {
    if (!file || file.size === 0) {
      if (kind === "DOCUMENT_BACK") continue; // passports have no back side
      throw new AppError("kyc_file_missing");
    }
    if (!KYC_MIME_TYPES.includes(file.type)) throw new AppError("kyc_file_type");
    if (file.size > KYC_MAX_FILE_BYTES)
      throw new AppError("kyc_file_too_large", { max: KYC_MAX_FILE_BYTES / 1024 / 1024 });
    files.push({ kind, mime: file.type, data: new Uint8Array(await file.arrayBuffer()) });
  }

  await prisma.$transaction([
    prisma.kycSubmission.create({
      data: { userId, fullName, documentType: type, documentNumber: number, files: { create: files } },
    }),
    prisma.user.update({ where: { id: userId }, data: { kycStatus: "PENDING" } }),
  ]);
}

export async function reviewKyc(submissionId: string, decision: "approve" | "reject", note: string | null) {
  const sub = await prisma.kycSubmission.findUniqueOrThrow({ where: { id: submissionId } });
  if (sub.status !== "PENDING") throw new AppError("already_settled");
  if (decision === "reject" && !note) throw new AppError("note_required");
  const status = decision === "approve" ? "VERIFIED" : "REJECTED";
  await prisma.$transaction([
    prisma.kycSubmission.update({
      where: { id: submissionId },
      data: { status, reviewNote: note, reviewedAt: new Date() },
    }),
    prisma.user.update({ where: { id: sub.userId }, data: { kycStatus: status } }),
  ]);
}
