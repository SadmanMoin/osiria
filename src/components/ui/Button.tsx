import Link from "next/link";
import type { ReactNode } from "react";

const variants = {
  primary:
    "bg-accent text-[#140f08] hover:bg-[#e6c56a] shadow-[0_0_0_1px_rgba(215,176,86,0.4)]",
  secondary:
    "bg-surface-elevated text-foreground border border-border hover:border-accent/40",
  ghost: "text-foreground hover:bg-white/5",
} as const;

type Variant = keyof typeof variants;

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  name,
  value,
}: {
  href?: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  name?: string;
  value?: string;
}) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} name={name} value={value} className={classes} disabled={disabled}>
      {children}
    </button>
  );
}
