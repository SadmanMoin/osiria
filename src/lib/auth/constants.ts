export const SESSION_COOKIE = "osiria_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const RESET_TTL_MS = 30 * 60 * 1000;

export const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";
export const ACCOUNT_UNAVAILABLE_MESSAGE = "This account cannot sign in.";
export const RESET_GENERIC_MESSAGE =
  "If an account exists for that email, a reset link is on its way.";
export const RESET_INVALID_MESSAGE = "This reset link is invalid or expired.";
export const RESET_SUCCESS_MESSAGE =
  "Password updated. Sign in with the new password.";
export const RATE_LIMIT_MESSAGE = "Too many attempts. Try again later.";
export const DATABASE_UNAVAILABLE_MESSAGE =
  "The database is not available yet. Set DATABASE_URL and apply migrations before using accounts.";
export const AUTH_REQUIRED_MESSAGE = "Authentication required.";
export const FORBIDDEN_MESSAGE = "You do not have access to this area.";
export const EMAIL_TAKEN_MESSAGE = "An account with that email already exists.";

export const USER_ROLES = ["WORKER", "ADVERTISER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SELF_SERVE_ROLES = ["WORKER", "ADVERTISER"] as const;
export type SelfServeRole = (typeof SELF_SERVE_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type FieldKey =
  | "displayName"
  | "email"
  | "password"
  | "confirmPassword"
  | "role"
  | "token";

export type FieldErrors = Partial<Record<FieldKey, string>>;

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  message?: string;
};
