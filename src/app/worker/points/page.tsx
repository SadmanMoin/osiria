import type { Metadata } from "next";
import Link from "next/link";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { PointsHistoryEntry } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "OP Points Ledger",
  robots: { index: false, follow: false },
};

export default function WorkerPointsPage() {
  return (
    <Protected area="worker" loginNext="/worker/points">
      {async (user) => {
        const store = getCampaignStore();
        let summary = { currentBalance: 0, totalEarned: 0, totalEntries: 0 };
        let history: PointsHistoryEntry[] = [];

        try {
          [summary, history] = await Promise.all([
            store.getWorkerPointsSummary(user.id),
            store.listWorkerPointsHistory(user.id),
          ]);
        } catch {
          // If db not reachable during build
        }

        return (
          <Container className="py-16">
            <div className="mb-4">
              <Link href="/worker" className="text-sm text-accent hover:underline">
                &larr; Back to Worker Dashboard
              </Link>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Append-Only Ledger
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">OP Balance & Points History</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Every approved task reward appends an immutable transaction to your points ledger.
              Worker OP balances are maintained in their own isolated ledger, separated from campaign
              budgets and advertiser funds.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm text-muted">Current Available Balance</p>
                <p className="mt-2 font-display text-4xl text-accent">{summary.currentBalance} OP</p>
                <p className="mt-1 text-xs text-muted">Available to hold or redeem</p>
              </Card>

              <Card>
                <p className="text-sm text-muted">Lifetime Earned</p>
                <p className="mt-2 font-display text-4xl text-teal">{summary.totalEarned} OP</p>
                <p className="mt-1 text-xs text-muted">Across {summary.totalEntries} ledger entries</p>
              </Card>
            </div>

            <div className="mt-12">
              <h2 className="font-display text-2xl tracking-tight">Ledger Transactions</h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-border text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">Delta</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Campaign / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-muted" colSpan={4}>
                          No transactions recorded yet in your points ledger.
                        </td>
                      </tr>
                    ) : (
                      history.map((entry) => (
                        <tr key={entry.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-muted">
                            {entry.createdAt.slice(0, 19).replace("T", " ")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-teal">
                            {entry.deltaPoints > 0 ? `+${entry.deltaPoints}` : entry.deltaPoints} OP
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-accent">
                              {entry.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {entry.campaignTitle ?? entry.note ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
