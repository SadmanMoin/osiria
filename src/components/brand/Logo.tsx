export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="6" fill="currentColor" />
        <path
          d="M14 3v4M14 21v4M3 14h4M21 14h4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span className="font-display text-lg tracking-tight">Osiria</span>
    </span>
  );
}
