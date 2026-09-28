import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../../scripts/database-url.mjs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = resolveDatabaseUrl();
  return new PrismaClient(url ? { datasourceUrl: url } : undefined);
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
