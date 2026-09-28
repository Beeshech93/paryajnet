// Resolve the database URL: DATABASE_URL, or the variables that Vercel's
// Postgres integrations inject (optionally with a store prefix such as
// "paryajnet_DATABASE_URL"). Empty values are ignored.
export function resolveDatabaseUrl(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const suffixes = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];
  for (const suffix of suffixes) {
    const key = Object.keys(env).find((k) => k.endsWith(`_${suffix}`) && env[k]);
    if (key) return env[key];
  }
  return "";
}
