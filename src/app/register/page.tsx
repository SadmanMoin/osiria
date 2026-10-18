import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Registration is a placeholder in Phase 1. No accounts are created.",
};

export default function RegisterPage() {
  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <Card className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Placeholder
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight">Create account</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Registration is reserved for a later phase. These fields are disabled
          so the UI can be reviewed without creating fake users or collecting
          credentials.
        </p>
        <form className="mt-8 space-y-4">
          <label className="block text-sm">
            Name
            <input
              disabled
              type="text"
              placeholder="Your name"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted"
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              disabled
              type="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              disabled
              type="password"
              placeholder="Create a password later"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted"
            />
          </label>
          <Button disabled className="w-full">
            Registration unavailable
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Already planning to return?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Login placeholder
          </Link>
        </p>
      </Card>
    </Container>
  );
}
