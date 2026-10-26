import { getPrisma } from "@/lib/db/prisma";
import { toListedUser, type ListedUser } from "@/lib/auth/repository";

export async function listAccounts(): Promise<ListedUser[]> {
  const users = await getPrisma().user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  return users.map((user) => toListedUser(user));
}

export async function countAccountsByRole(): Promise<{
  workers: number;
  advertisers: number;
  admins: number;
}> {
  const prisma = getPrisma();
  const [workers, advertisers, admins] = await Promise.all([
    prisma.user.count({ where: { role: "WORKER" } }),
    prisma.user.count({ where: { role: "ADVERTISER" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  return { workers, advertisers, admins };
}
