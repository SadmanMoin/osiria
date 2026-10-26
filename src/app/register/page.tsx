import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/AuthForms";
import { homeForRole } from "@/lib/auth/authorization";
import { getOptionalUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Register",
  description: "Create an Osiria worker or advertiser account. Admin accounts are not public.",
};

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <AuthShell
          eyebrow="Account"
          title="Create account"
          description="Checking your session…"
        >
          {null}
        </AuthShell>
      }
    >
      <RegisterContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RegisterContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = Array.isArray(query.next) ? query.next[0] ?? "" : query.next ?? "";
  const user = await getOptionalUser();
  if (user) {
    redirect(homeForRole(user.role));
  }

  return (
    <AuthShell
      eyebrow="Account"
      title="Create account"
      description="Workers complete social tasks. Advertisers fund campaigns. This form cannot create an admin."
      footer={
        <Link href="/login" className="text-accent hover:underline">
          Already have an account? Log in
        </Link>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
