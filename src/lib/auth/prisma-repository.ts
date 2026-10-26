import type { UserRole as PrismaUserRole, UserStatus as PrismaUserStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { UserRole, UserStatus } from "@/lib/auth/constants";
import type { AuthRepository, StoredUser } from "@/lib/auth/repository";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function asRole(role: string): UserRole | null {
  if (role === "WORKER" || role === "ADVERTISER" || role === "ADMIN") {
    return role;
  }
  return null;
}

function asStatus(status: string): UserStatus | null {
  if (status === "ACTIVE" || status === "SUSPENDED" || status === "DISABLED") {
    return status;
  }
  return null;
}

function toStoredUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: PrismaUserRole;
  status: PrismaUserStatus;
  passwordHash: string | null;
}): StoredUser | null {
  const role = asRole(user.role);
  const status = asStatus(user.status);
  if (!role || !status) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role,
    status,
    passwordHash: user.passwordHash,
  };
}

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  passwordHash: true,
} as const;

export const prismaAuthRepository: AuthRepository = {
  async findUserByEmail(email) {
    const user = await getPrisma().user.findUnique({
      where: { email },
      select: userSelect,
    });
    return user ? toStoredUser(user) : null;
  },

  async createUser(input) {
    try {
      const user = await getPrisma().user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          passwordHash: input.passwordHash,
          status: "ACTIVE",
        },
        select: userSelect,
      });
      const stored = toStoredUser(user);
      if (!stored) {
        throw new Error("Created user could not be read.");
      }
      return stored;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return "EMAIL_TAKEN";
      }
      throw error;
    }
  },

  async createSession(input) {
    await getPrisma().session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  },

  async findSessionUser(tokenHash, now) {
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: userSelect } },
    });
    if (!session) {
      return null;
    }
    const user = toStoredUser(session.user);
    if (session.expiresAt <= now || !user || user.status !== "ACTIVE") {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    return user;
  },

  async deleteSession(tokenHash) {
    await getPrisma().session.deleteMany({ where: { tokenHash } });
  },

  async deleteSessionsForUser(userId) {
    await getPrisma().session.deleteMany({ where: { userId } });
  },

  async saveResetToken(input) {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: input.userId, usedAt: null },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
    });
  },

  async consumeResetToken(input) {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash: input.tokenHash,
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        data: { usedAt: input.now },
      });
      if (updated.count !== 1) {
        return "INVALID";
      }
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash: input.tokenHash },
      });
      if (!token) {
        return "INVALID";
      }
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: input.passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: token.userId } });
      return "OK";
    });
  },
};

export function getAuthRepository(): AuthRepository {
  return prismaAuthRepository;
}
