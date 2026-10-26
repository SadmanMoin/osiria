import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password with a one-time reset link.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <AuthShell eyebrow="Account" title="Choose a new password" description="Loading the reset form…">
          {null}
        </AuthShell>
      }
    >
      <ResetContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] ?? "" : query.token ?? "";

  return (
    <AuthShell
      eyebrow="Account"
      title="Choose a new password"
      description="Reset links expire after 30 minutes and work once. Signing in again is required."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
