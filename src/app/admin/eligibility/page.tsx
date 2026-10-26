import type { Metadata } from "next";
import Link from "next/link";
import { Protected } from "@/components/auth/Protected";
import { EligibilitySettingsForm } from "@/components/eligibility/EligibilityForms";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { getEligibilityStore } from "@/lib/eligibility/prisma-store";
import { describeRule } from "@/lib/eligibility/rules";
import { listEligibilityAuditLogs, listPlatformRules } from "@/lib/eligibility/service";

export const metadata: Metadata = {
  title: "Eligibility settings",
  robots: { index: false, follow: false },
};

export default function EligibilitySettingsPage() {
  return (
    <Protected area="admin" loginNext="/admin/eligibility">
      {async () => {
        const store = getEligibilityStore();
        const [rules, auditLogs] = await Promise.all([
          listPlatformRules(store),
          listEligibilityAuditLogs(store),
        ]);
        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Eligibility settings</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              These thresholds are saved in the database. X and Instagram start as an account
              created on or before 2022-12-31 or at least 1000 followers. Facebook starts at 50
              friends. Osiria does not call X, Facebook, or Instagram, and it does not invent
              missing profile data.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/admin/eligibility/reviews" className="text-accent hover:underline">
                Review pending accounts
              </Link>
            </p>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {rules.map((rule) => (
                <Card key={rule.platform}>
                  <h2 className="font-display text-2xl">{rule.displayName}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{describeRule(rule)}</p>
                  <div className="mt-6">
                    <EligibilitySettingsForm rule={rule} />
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-12">
              <h2 className="font-display text-2xl tracking-tight">Recent audit activity</h2>
              <p className="mt-1 text-sm text-muted">
                Every threshold update and manual review decision is logged with the admin&apos;s identity.
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-border text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">Admin</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-muted" colSpan={4}>
                          No audit activity recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-muted">{log.createdAt.slice(0, 19).replace("T", " ")}</td>
                          <td className="px-4 py-3">{log.actorName ?? log.actorEmail ?? log.actorUserId}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-accent">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">{log.entityId ?? log.entityType}</td>
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
