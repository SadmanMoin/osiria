import { originForRequest, ipFromRequest, readJsonObject } from "@/lib/auth/http";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { authFailureResponse, authSuccessResponse, databaseUnavailableResponse } from "@/lib/auth/responses";
import { createProductionAuthDeps } from "@/lib/auth/runtime";
import { registerAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (body instanceof Response) {
    return body;
  }

  try {
    const result = await registerAccount(
      getAuthRepository(),
      {
        displayName: body.displayName,
        email: body.email,
        password: body.password,
        confirmPassword: body.confirmPassword,
        role: body.role,
      },
      ipFromRequest(request),
      await createProductionAuthDeps(originForRequest(request)),
    );
    if (!result.ok) {
      return authFailureResponse(result);
    }
    return authSuccessResponse(result, 201);
  } catch {
    return databaseUnavailableResponse();
  }
}
