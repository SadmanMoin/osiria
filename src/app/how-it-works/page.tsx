import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How Osiria works for advertisers and workers. Verification and payments are not live.",
};

const phases = [
  {
    title: "Discover",
    body: "Campaigns list the brand, platforms, task, and reward label. In Phase 1 this list is a static preview so the product language can be reviewed.",
  },
  {
    title: "Apply and complete",
    body: "A later phase will let participants accept a campaign and complete the social work described in the brief.",
  },
  {
    title: "Verify",
    body: "Social proof will be checked against the campaign rules. That system is not implemented here and is not simulated.",
  },
  {
    title: "Settle",
    body: "Payouts, wallets, and accounting belong to a later phase. This site does not process value.",
  },
];

export default function HowItWorksPage() {
  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="The model"
        title="How Osiria is meant to work"
        description="Social-to-Earn is not generic airdrop farming. Brands fund a specific action. People complete that action. Verification and settlement come after the public surface is in place."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {phases.map((phase, index) => (
          <Card key={phase.title}>
            <p className="font-mono text-sm text-accent">0{index + 1}</p>
            <h2 className="mt-3 font-display text-2xl">{phase.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{phase.body}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-8 bg-surface-elevated">
        <h2 className="font-display text-2xl">What is still out of scope</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>It signs accounts in with a server-side session. Campaign verification is still not live.</li>
          <li>It does not check social profiles or post URLs.</li>
          <li>It does not move money or show fabricated balances.</li>
        </ul>
      </Card>
    </Container>
  );
}
