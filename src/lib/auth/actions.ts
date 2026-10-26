"use server";

import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { safeNextPath } from "@/lib/auth/authorization";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  SESSION_COOKIE,
  type FormState,
} from "@/lib/auth/constants";
import { ipFromForwarded, resolveAppOrigin } from "@/lib/auth/http";
import { getAuthRepository } from "@/lib/auth/prisma-repository";
import { createProductionAuthDeps } from "@/lib/auth/runtime";
import {
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
} from "@/lib/auth/service";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { hashSecretToken } from "@/lib/auth/tokens";

async function requestContext(): Promise<{ ip: string; origin: string }> {
  const headerStore = await headers();
  return {
    ip: ipFromForwarded(headerStore.get("x-forwarded-for"), headerStore.get("x-real-ip")),
    origin: resolveAppOrigin({
      appOrigin: process.env.APP_ORIGIN,
      nodeEnv: process.env.NODE_ENV,
      host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
      proto: headerStore.get("x-forwarded-proto"),
    }),
  };
}

function formError(result: {
  message: string;
  fieldErrors?: FormState["fieldErrors"];
}): FormState {
  return { error: result.message, fieldErrors: result.fieldErrors };
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const context = await requestContext();
  try {
    const result = await registerAccount(
      getAuthRepository(),
      {
        displayName: formData.get("displayName"),
        email: formData.get("email"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
        role: formData.get("role"),
      },
      context.ip,
      await createProductionAuthDeps(context.origin),
    );
    if (!result.ok) {
      return formError(result);
    }
    await setSessionCookie(result.sessionToken);
    redirect(safeNextPath(stringValue(formData.get("next")), result.user.role));
  } catch (error) {
    unstable_rethrow(error);
    return { error: DATABASE_UNAVAILABLE_MESSAGE };
  }
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const context = await requestContext();
  try {
    const result = await loginAccount(
      getAuthRepository(),
      {
        email: formData.get("email"),
        password: formData.get("password"),
      },
      context.ip,
      await createProductionAuthDeps(context.origin),
    );
    if (!result.ok) {
      return formError(result);
    }
    await setSessionCookie(result.sessionToken);
    redirect(safeNextPath(stringValue(formData.get("next")), result.user.role));
  } catch (error) {
    unstable_rethrow(error);
    return { error: DATABASE_UNAVAILABLE_MESSAGE };
  }
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  try {
    await logoutAccount(getAuthRepository(), token, { hashToken: hashSecretToken });
  } catch {
    // The cookie is cleared even when the session row cannot be deleted.
  }
  await clearSessionCookie();
  redirect("/");
}

export async function forgotPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requestContext();
  try {
    const result = await requestPasswordReset(
      getAuthRepository(),
      { email: formData.get("email"), ip: context.ip },
      await createProductionAuthDeps(context.origin),
    );
    if (!result.ok) {
      return formError(result);
    }
    return { message: result.message };
  } catch {
    return { error: DATABASE_UNAVAILABLE_MESSAGE };
  }
}

export async function resetPasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requestContext();
  try {
    const result = await resetPassword(
      getAuthRepository(),
      {
        token: formData.get("token"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
      },
      context.ip,
      await createProductionAuthDeps(context.origin),
    );
    if (!result.ok) {
      return formError(result);
    }
    return { message: result.message };
  } catch {
    return { error: DATABASE_UNAVAILABLE_MESSAGE };
  }
}

function stringValue(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value : null;
}
