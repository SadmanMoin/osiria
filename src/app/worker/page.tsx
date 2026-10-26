import type { Metadata } from "next";
import { Protected } from "@/components/auth/Protected";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { roleLabel } from "@/lib/auth/authorization";
import { getCampaignStore } from "@/lib/campaigns/prisma-store";
import type { StoredSubmission } from "@/lib/campaigns/types";

export const metadata: Metadata = {
  title: "Worker Dashboard",
  robots: { index: false, follow: false },
};

export default function WorkerPage() {
  return (
    <Protected area="worker" loginNext="/worker">
      {async (user) => {
        const store = getCampaignStore();
        let points = { currentBalance: 0, totalEarned: 0, totalEntries: 0 };
        let submissions: StoredSubmission[] = [];

        try {
          [points, submissions] = await Promise.all([
            store.getWorkerPointsSummary(user.id),
            store.listSubmissions({ userId: user.id }),
          ]);
        } catch {
          // If db not reachable during build
        }

        const pendingCount = submissions.filter((s) => s.status === "PENDING" || s.status === "APPEALED").length;
        const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;

        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Worker Dashboard</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Welcome, {user.displayName}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Signed in as {roleLabel(user.role)}. Complete campaign tasks on social platforms, submit
              proof URLs, and earn OP points tracked in an append-only ledger.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-muted">Current OP Balance</p>
                <p className="mt-2 font-display text-3xl text-accent">{points.currentBalance} OP</p>
                <p className="mt-1 text-xs text-muted">{points.totalEarned} lifetime OP earned</p>
              </Card>

              <Card>
                <p className="text-sm text-muted">Pending Submissions</p>
                <p className="mt-2 font-display text-3xl">{pendingCount}</p>
                <p className="mt-1 text-xs text-muted">Awaiting advertiser review</p>
              </Card>

              <Card>
                <p className="text-sm text-muted">Approved Tasks</p>
                <p className="mt-2 font-display text-3xl text-teal">{approvedCount}</p>
                <p className="mt-1 text-xs text-muted">Rewards received</p>
              </Card>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button href="/campaigns" variant="secondary">
                Browse Campaigns
              </Button>
              <Button href="/worker/submissions" variant="secondary">
                My Submissions & Appeals ({submissions.length})
              </Button>
              <Button href="/worker/points" variant="secondary">
                Points Ledger History
              </Button>
              <Button href="/worker/eligibility" variant="ghost">
                Social Eligibility
              </Button>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
