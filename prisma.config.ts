import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI reads DATABASE_URL from the environment. The fallback is a
// non-secret placeholder so `prisma validate` / `prisma generate` can run
// without a live database. Migrate and health checks still need a real URL.
const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://USER:PASSWORD@127.0.0.1:5432/osiria";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
