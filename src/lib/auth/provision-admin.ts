import { validatePassword } from "@/lib/auth/password";
import { parseEmailAddress } from "@/lib/auth/validation";

const REFUSAL =
  "Refusing to create an admin account. Set ADMIN_EMAIL and a unique ADMIN_PASSWORD in the environment. This project does not include a default admin password.";

export function validateAdminProvision(
  email: string | undefined,
  password: string | undefined,
): { ok: true; email: string; password: string } | { ok: false; message: string } {
  if (!email?.trim() || !password) {
    return { ok: false, message: REFUSAL };
  }

  const parsedEmail = parseEmailAddress(email);
  if (!parsedEmail.ok) {
    return { ok: false, message: "ADMIN_EMAIL is not a valid email address." };
  }

  const passwordCheck = validatePassword(password, parsedEmail.email);
  if (!passwordCheck.ok) {
    return { ok: false, message: `${REFUSAL} ${passwordCheck.message}` };
  }

  return { ok: true, email: parsedEmail.email, password };
}
