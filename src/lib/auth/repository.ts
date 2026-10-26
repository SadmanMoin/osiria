import type { PublicUser, UserRole, UserStatus } from "@/lib/auth/constants";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string | null;
};

export type ListedUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

export function toListedUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  passwordHash?: string | null;
}): ListedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  createUser(input: {
    email: string;
    displayName: string;
    role: UserRole;
    passwordHash: string;
  }): Promise<StoredUser | "EMAIL_TAKEN">;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findSessionUser(tokenHash: string, now: Date): Promise<StoredUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  saveResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  consumeResetToken(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<"OK" | "INVALID">;
}
