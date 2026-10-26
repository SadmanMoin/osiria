import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <Card className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
      </Card>
    </Container>
  );
}
