import type { Metadata } from "next";
import { Protected } from "@/components/auth/Protected";
import { Container } from "@/components/ui/Container";
import { listAccounts } from "@/lib/auth/admin-data";
import { roleLabel } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  title: "Accounts",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <Protected area="admin" loginNext="/admin/users">
      {async () => {
        const users = await listAccounts();
        return (
          <Container className="py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Admin</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Accounts</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
              Password hashes are not loaded for this list. New admins are created with{" "}
              <code className="text-foreground">npm run auth:create-admin</code> and a password you
              supply in the environment.
            </p>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={5}>
                        No accounts yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((account) => (
                      <tr key={account.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{account.displayName}</td>
                        <td className="px-4 py-3">{account.email}</td>
                        <td className="px-4 py-3">{roleLabel(account.role)}</td>
                        <td className="px-4 py-3">{account.status}</td>
                        <td className="px-4 py-3">{account.createdAt.slice(0, 10)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Container>
        );
      }}
    </Protected>
  );
}
