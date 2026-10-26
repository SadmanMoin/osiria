import "dotenv/config";
import { getPrisma } from "@/lib/db/prisma";
import { normalizeProofUrl } from "@/lib/security/fraud";

async function main() {
  const prisma = getPrisma();
  try {
    let updated = 0;
    while (true) {
      const rows = await prisma.taskSubmission.findMany({ where: { normalizedProofUrl: null }, select: { id: true, proofUrl: true }, take: 500 });
      if (!rows.length) break;
      for (const row of rows) {
        await prisma.taskSubmission.update({ where: { id: row.id }, data: { normalizedProofUrl: normalizeProofUrl(row.proofUrl ?? "") } });
        updated++;
      }
    }
    console.info(`Backfilled ${updated} proof comparison keys.`);
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Proof backfill failed; inspect database availability and retry."); process.exitCode = 1; });
