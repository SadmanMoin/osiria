import type { Metadata } from "next";
import Link from "next/link";
import { Protected } from "@/components/auth/Protected";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { countAccountsByRole } from "@/lib/auth/admin-data";
import { roleLabel } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Protected area="admin" loginNext="/admin">
      {async (user) => {
        const counts = await countAccountsByRole();
        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Operations</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Signed in as {user.displayName} ({roleLabel(user.role)}). Worker and advertiser
              sessions receive 403 here. There is no shared default admin password.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-sm text-muted">Workers</p>
                <p className="mt-2 font-display text-3xl">{counts.workers}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted">Advertisers</p>
                <p className="mt-2 font-display text-3xl">{counts.advertisers}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted">Admins</p>
                <p className="mt-2 font-display text-3xl">{counts.admins}</p>
              </Card>
            </div>
            <p className="mt-8 flex flex-wrap gap-4 text-sm">
              <Link href="/admin/users" className="text-accent hover:underline">
                Review accounts
              </Link>
              <Link href="/admin/campaigns" className="text-accent hover:underline">
                Campaign moderation
              </Link>
              <Link href="/admin/submissions" className="text-accent hover:underline">
                Submissions & appeals
              </Link>
              <Link href="/admin/fraud" className="text-amber-400 hover:underline">
                Fraud & security
              </Link>
              <Link href="/admin/eligibility" className="text-accent hover:underline">
                Eligibility settings
              </Link>
              <Link href="/admin/eligibility/reviews" className="text-accent hover:underline">
                Eligibility reviews
              </Link>
            </p>
          </Container>
        );
      }}
    </Protected>
  );
}
