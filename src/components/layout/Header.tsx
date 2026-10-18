"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { navLinks } from "@/lib/site";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-accent" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button href="/login" variant="ghost">
            Log in
          </Button>
          <Button href="/register">Create account</Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="flex flex-col gap-1.5">
            <span
              className={`block h-px w-4 bg-foreground transition ${open ? "translate-y-[4px] rotate-45" : ""}`}
            />
            <span
              className={`block h-px w-4 bg-foreground transition ${open ? "-translate-y-[4px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </Container>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-border bg-background md:hidden"
        >
          <Container className="flex flex-col gap-4 py-5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-base text-foreground"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button href="/login" variant="secondary">
                Log in
              </Button>
              <Button href="/register">Create account</Button>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
