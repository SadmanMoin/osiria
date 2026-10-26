import type { FieldErrors, SelfServeRole } from "@/lib/auth/constants";
import { validatePassword } from "@/lib/auth/password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedRegistration = {
  displayName: string;
  email: string;
  password: string;
  role: SelfServeRole;
};

export type ParseFailure = {
  ok: false;
  message: string;
  fieldErrors: FieldErrors;
};

function fail(fieldErrors: FieldErrors): ParseFailure {
  const message = Object.values(fieldErrors)[0] ?? "Check the form and try again.";
  return { ok: false, message, fieldErrors };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseEmailAddress(
  value: unknown,
): { ok: true; email: string } | ParseFailure {
  if (typeof value !== "string") {
    return fail({ email: "Enter a valid email address." });
  }
  const email = normalizeEmail(value);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return fail({ email: "Enter a valid email address." });
  }
  return { ok: true, email };
}

export function parseDisplayName(
  value: unknown,
): { ok: true; displayName: string } | ParseFailure {
  if (typeof value !== "string") {
    return fail({ displayName: "Enter your name." });
  }
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) {
    return fail({ displayName: "Name must be between 2 and 80 characters." });
  }
  if (/[\u0000-\u001F\u007F]/.test(displayName)) {
    return fail({ displayName: "Name contains characters that are not allowed." });
  }
  return { ok: true, displayName };
}

function parseRole(value: unknown): { ok: true; role: SelfServeRole } | ParseFailure {
  if (value === "WORKER" || value === "ADVERTISER") {
    return { ok: true, role: value };
  }
  return fail({ role: "Choose Worker or Advertiser." });
}

export function parseRegistration(input: {
  displayName: unknown;
  email: unknown;
  password: unknown;
  confirmPassword: unknown;
  role: unknown;
}): { ok: true; data: ParsedRegistration } | ParseFailure {
  const fieldErrors: FieldErrors = {};
  const name = parseDisplayName(input.displayName);
  const email = parseEmailAddress(input.email);
  const role = parseRole(input.role);

  if (!name.ok) {
    fieldErrors.displayName = name.fieldErrors.displayName;
  }
  if (!email.ok) {
    fieldErrors.email = email.fieldErrors.email;
  }
  if (!role.ok) {
    fieldErrors.role = role.fieldErrors.role;
  }

  if (typeof input.password !== "string" || typeof input.confirmPassword !== "string") {
    fieldErrors.password = "Enter a password.";
  } else {
    const password = validatePassword(input.password, email.ok ? email.email : "invalid@local");
    if (!password.ok) {
      fieldErrors.password = password.message;
    } else if (input.password !== input.confirmPassword) {
      fieldErrors.confirmPassword = "Passwords do not match.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail(fieldErrors);
  }

  if (!name.ok || !email.ok || !role.ok || typeof input.password !== "string") {
    return fail(fieldErrors);
  }

  return {
    ok: true,
    data: {
      displayName: name.displayName,
      email: email.email,
      password: input.password,
      role: role.role,
    },
  };
}

export function parseLogin(input: {
  email: unknown;
  password: unknown;
}): { ok: true; email: string; password: string } | ParseFailure {
  const fieldErrors: FieldErrors = {};
  const email = parseEmailAddress(input.email);
  if (!email.ok) {
    fieldErrors.email = email.fieldErrors.email;
  }
  if (typeof input.password !== "string" || input.password.length === 0) {
    fieldErrors.password = "Enter your password.";
  } else if (input.password.length > 128) {
    fieldErrors.password = "Password must be at most 128 characters.";
  }
  if (Object.keys(fieldErrors).length > 0 || !email.ok || typeof input.password !== "string") {
    return fail(fieldErrors);
  }
  return { ok: true, email: email.email, password: input.password };
}

export function parsePasswordReset(input: {
  token: unknown;
  password: unknown;
  confirmPassword: unknown;
}): { ok: true; token: string; password: string } | ParseFailure {
  const fieldErrors: FieldErrors = {};
  let token = "";
  if (typeof input.token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(input.token)) {
    fieldErrors.token = "This reset link is invalid or expired.";
  } else {
    token = input.token;
  }

  if (typeof input.password !== "string" || typeof input.confirmPassword !== "string") {
    fieldErrors.password = "Enter a new password.";
  } else {
    const password = validatePassword(input.password, "reset@local");
    if (!password.ok) {
      fieldErrors.password = password.message;
    } else if (input.password !== input.confirmPassword) {
      fieldErrors.confirmPassword = "Passwords do not match.";
    }
  }

  if (Object.keys(fieldErrors).length > 0 || typeof input.password !== "string") {
    return fail(fieldErrors);
  }

  return { ok: true, token, password: input.password };
}
