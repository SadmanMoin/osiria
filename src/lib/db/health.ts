import { getPrisma, isDatabaseConfigured } from "@/lib/db/prisma";

export type DatabaseHealth = {
  ok: boolean;
  configured: boolean;
  message: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      message: "DATABASE_URL is not set",
    };
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return {
      ok: true,
      configured: true,
      message: "Database connection succeeded",
    };
  } catch {
    return {
      ok: false,
      configured: true,
      message: "Database connection failed",
    };
  }
}
