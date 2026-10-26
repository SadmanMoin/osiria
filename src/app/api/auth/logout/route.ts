import { readSessionCookie, rejectCrossOrigin } from "@/lib/auth/http";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { clearedSessionResponse } from "@/lib/auth/responses";
import { logoutAccount } from "@/lib/auth/service";
import { hashSecretToken } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) {
    return blocked;
  }

  try {
    await logoutAccount(getAuthRepository(), readSessionCookie(request), {
      hashToken: hashSecretToken,
    });
  } catch {
    // Clear the browser session even if the database is unavailable.
  }
  return clearedSessionResponse();
}
