import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { StoredAuditLog } from "@/lib/security/types";

export type AuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Persists an admin audit log entry to PostgreSQL via Prisma.
 */
export async function recordPrismaAuditLog(input: AuditLogInput): Promise<StoredAuditLog> {
  const prisma = getPrisma();
  const row = await prisma.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
    include: {
      actor: { select: { email: true, displayName: true } },
    },
  });

  return {
    id: row.id,
    actorUserId: row.actorUserId,
    actorEmail: row.actor.email,
    actorDisplayName: row.actor.displayName,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lists audit logs from Prisma with pagination and optional filtering.
 */
export async function listPrismaAuditLogs(options?: {
  actorUserId?: string;
  entityType?: string;
  limit?: number;
}): Promise<StoredAuditLog[]> {
  const prisma = getPrisma();
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (options?.actorUserId) where.actorUserId = options.actorUserId;
  if (options?.entityType) where.entityType = options.entityType;

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(options?.limit ?? 100, 200)),
    include: {
      actor: { select: { email: true, displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorEmail: r.actor.email,
    actorDisplayName: r.actor.displayName,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: (r.metadata as Record<string, unknown>) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
