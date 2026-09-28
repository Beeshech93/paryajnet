// Point prisma/schema.prisma at the database in use:
// "file:..." → sqlite (local development), "postgres://..." → postgresql (production).
import { readFileSync, writeFileSync } from "node:fs";
import { resolveDatabaseUrl } from "./database-url.mjs";

const url = resolveDatabaseUrl();
if (process.env.VERCEL && !/^postgres(ql)?:\/\//.test(url)) {
  console.error(
    "No Postgres connection string found on Vercel " +
      (url ? "(DATABASE_URL is not postgres://)." : "(set DATABASE_URL or connect a Postgres store to the project)."),
  );
  process.exit(1);
}
const provider = /^postgres(ql)?:\/\//.test(url) ? "postgresql" : "sqlite";
const path = new URL("../prisma/schema.prisma", import.meta.url);
const schema = readFileSync(path, "utf8");
const next = schema.replace(/(datasource db \{\s*provider\s*=\s*)"[^"]+"/, `$1"${provider}"`);
if (next !== schema) writeFileSync(path, next);
console.log(`prisma datasource: ${provider}`);
