import { ipFromRequest, originForRequest, readJsonObject } from "@/lib/auth/http";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { authFailureResponse, authSuccessResponse, databaseUnavailableResponse } from "@/lib/auth/responses";
import { createProductionAuthDeps } from "@/lib/auth/runtime";
import { loginAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (body instanceof Response) {
    return body;
  }

  try {
    const result = await loginAccount(
      getAuthRepository(),
      { email: body.email, password: body.password },
      ipFromRequest(request),
      await createProductionAuthDeps(originForRequest(request)),
    );
    if (!result.ok) {
      return authFailureResponse(result);
    }
    return authSuccessResponse(result, 200);
  } catch {
    return databaseUnavailableResponse();
  }
}
