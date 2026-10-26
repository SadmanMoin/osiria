import "dotenv/config";
import { hashPassword } from "@/lib/auth/password";
import { validateAdminProvision } from "@/lib/auth/provision-admin";
import { getPrisma } from "@/lib/db/prisma";

async function main() {
  const provision = validateAdminProvision(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  if (!provision.ok) {
    console.error(provision.message);
    process.exitCode = 1;
    return;
  }

  try {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({
      where: { email: provision.email },
      select: { id: true },
    });
    if (existing) {
      console.error(
        "An account with that email already exists. This command will not change its password.",
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(provision.password);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: provision.email,
          displayName: "Administrator",
          role: "ADMIN",
          status: "ACTIVE",
          passwordHash,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: user.id,
          action: "user.admin.provision",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "auth:create-admin" },
        },
      });
    });
    console.log("Admin account created. The password was not printed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DATABASE_URL is not set") {
      console.error("DATABASE_URL is not set.");
    } else {
      console.error("Admin account was not created.");
    }
    process.exitCode = 1;
  }
}

void main();
