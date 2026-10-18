import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "teal" | "warn";
}) {
  const tones = {
    neutral: "border-border text-muted",
    accent: "border-accent/30 bg-accent-soft text-accent",
    teal: "border-teal/30 bg-teal/10 text-teal",
    warn: "border-danger/30 bg-danger/10 text-danger",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
