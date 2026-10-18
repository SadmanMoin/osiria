import { SAMPLE_DATA_NOTICE } from "@/data/sample-campaigns";

export function SampleDataNotice() {
  return (
    <p className="rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm leading-6 text-foreground/90">
      {SAMPLE_DATA_NOTICE}
    </p>
  );
}
