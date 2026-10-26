import { ipFromRequest, originForRequest, readJsonObject } from "@/lib/auth/http";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { databaseUnavailableResponse, messageResponse } from "@/lib/auth/responses";
import { createProductionAuthDeps } from "@/lib/auth/runtime";
import { requestPasswordReset } from "@/lib/auth/service";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (body instanceof Response) {
    return body;
  }

  try {
    const result = await requestPasswordReset(
      getAuthRepository(),
      { email: body.email, ip: ipFromRequest(request) },
      await createProductionAuthDeps(originForRequest(request)),
    );
    return messageResponse(result);
  } catch {
    return databaseUnavailableResponse();
  }
}
