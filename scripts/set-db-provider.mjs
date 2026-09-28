// Point prisma/schema.prisma at the database in DATABASE_URL:
// "file:..." → sqlite (local development), "postgres://..." → postgresql (production).
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "";
if (process.env.VERCEL && !/^postgres(ql)?:\/\//.test(url)) {
  console.error(
    "DATABASE_URL must be a postgres:// connection string on Vercel " +
      (url ? "(got a non-Postgres value)." : "(it is empty). Set it in Project → Settings → Environment Variables."),
  );
  process.exit(1);
}
const provider = /^postgres(ql)?:\/\//.test(url) ? "postgresql" : "sqlite";
const path = new URL("../prisma/schema.prisma", import.meta.url);
const schema = readFileSync(path, "utf8");
const next = schema.replace(/(datasource db \{\s*provider\s*=\s*)"[^"]+"/, `$1"${provider}"`);
if (next !== schema) writeFileSync(path, next);
console.log(`prisma datasource: ${provider}`);
