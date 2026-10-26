import { getAuthRepository } from "@/lib/auth/prisma-repository";
import type { StoredUser } from "@/lib/auth/repository";
import { isDatabaseConfigured } from "@/lib/db/prisma";

export async function resolveSessionUser(tokenHash: string): Promise<StoredUser | null> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not set");
  }
  return getAuthRepository().findSessionUser(tokenHash, new Date());
}
