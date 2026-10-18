import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Log in",
  description: "Login is a placeholder in Phase 1. Authentication is not implemented.",
};

export default function LoginPage() {
  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <Card className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Placeholder
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight">Log in</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Account access is not available yet. This page exists so navigation and
          future auth screens have a real route. Nothing you type here is
          submitted or stored.
        </p>
        <form className="mt-8 space-y-4">
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
              placeholder="••••••••"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted"
            />
          </label>
          <Button disabled className="w-full">
            Sign in unavailable
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Need an account later?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Register placeholder
          </Link>
        </p>
      </Card>
    </Container>
  );
}
