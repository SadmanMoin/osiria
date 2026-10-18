import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Container";
import { navLinks } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo className="text-accent" />
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            Social-to-Earn infrastructure for brands and participants. Phase 1
            is a public product preview.
          </p>
        </div>
        <nav className="flex flex-col gap-3 text-sm" aria-label="Footer">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="text-muted hover:text-foreground">
            Log in
          </Link>
          <Link href="/register" className="text-muted hover:text-foreground">
            Register
          </Link>
        </nav>
      </Container>
      <Container className="border-t border-border py-6 text-xs text-muted">
        © 2026 Osiria. Preview UI only.
      </Container>
    </footer>
  );
}
