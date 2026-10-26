import type { Metadata } from "next";
import { Protected } from "@/components/auth/Protected";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { homeForRole, roleLabel } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <Protected area="account" loginNext="/account">
      {(user) => (
        <Container className="py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Account</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">{user.displayName}</h1>
          <Card className="mt-8 max-w-xl">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="mt-1">{user.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Role</dt>
                <dd className="mt-1">{roleLabel(user.role)}</dd>
              </div>
            </dl>
            <div className="mt-6">
              <Button href={homeForRole(user.role)} variant="secondary">
                Open dashboard
              </Button>
            </div>
          </Card>
        </Container>
      )}
    </Protected>
  );
}
