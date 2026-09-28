// Vercel build: resolve the database URL, sync the schema, then build Next.js.
import { execSync } from "node:child_process";
import { resolveDatabaseUrl } from "./database-url.mjs";

const env = { ...process.env, DATABASE_URL: resolveDatabaseUrl() };
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("node scripts/set-db-provider.mjs");
run("npx prisma generate");
run("npx prisma db push --skip-generate");
run("npx next build");
