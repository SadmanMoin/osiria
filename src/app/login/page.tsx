import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { safeNextPath } from "@/lib/auth/authorization";
import { getOptionalUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to an Osiria worker, advertiser, or admin account.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <AuthShell eyebrow="Account" title="Log in" description="Checking your session…">
          {null}
        </AuthShell>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = firstQuery(query.next) ?? "";
  const user = await getOptionalUser();
  if (user) {
    redirect(safeNextPath(next || null, user.role));
  }

  return (
    <AuthShell
      eyebrow="Account"
      title="Log in"
      description="Use the email and password for your worker, advertiser, or admin account."
      footer={
        <>
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot password
          </Link>
          <span> · </span>
          <Link href="/register" className="text-accent hover:underline">
            Create account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
