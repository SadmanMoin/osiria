import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SampleDataNotice } from "@/components/ui/SampleDataNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { sampleCampaigns } from "@/data/sample-campaigns";

const steps = [
  {
    title: "Browse campaigns",
    body: "See brand briefs, platforms, and reward labels in one place. Live matching comes later.",
  },
  {
    title: "Complete social work",
    body: "Posts, replies, videos, and community tasks stay attached to a campaign, not a one-off shoutout.",
  },
  {
    title: "Verify and earn later",
    body: "Social verification, wallets, and payouts are out of scope for Phase 1. This preview stops at the public product surface.",
  },
];

const audiences = [
  {
    title: "For participants",
    body: "Turn the accounts you already run into structured campaign work with clear briefs instead of informal DMs.",
  },
  {
    title: "For brands",
    body: "Fund a campaign, set the task, and review a roster of people who can actually complete the work.",
  },
  {
    title: "For operators",
    body: "Osiria is being built as Social-to-Earn infrastructure: campaigns, verification, and settlement in later phases.",
  },
];

export default function Home() {
  const featured = sampleCampaigns.slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(215,176,86,0.16),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(126,224,200,0.1),transparent_32%)]"
        />
        <Container className="relative grid gap-12 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Social-to-Earn
            </p>
            <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-6xl">
              Campaigns that pay people for real social work.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Osiria is a marketplace layer for brands that need posts, threads,
              and community amplification — and for people who want to earn from
              the audiences they already built.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/campaigns">View sample campaigns</Button>
              <Button href="/how-it-works" variant="secondary">
                How it works
              </Button>
            </div>
          </div>
          <Card className="relative overflow-hidden bg-surface-elevated">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              Product preview
            </p>
            <p className="mt-4 font-display text-3xl tracking-tight">
              No live wallets. No fake logins. No staged payouts.
            </p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Phase 1 ships the public site, navigation, and a campaign gallery
              backed by local sample records so the product can be reviewed
              before any backend work begins.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div>
                <dt className="text-muted">Sample campaigns</dt>
                <dd className="mt-1 font-display text-2xl">{sampleCampaigns.length}</dd>
              </div>
              <div>
                <dt className="text-muted">Public routes</dt>
                <dd className="mt-1 font-display text-2xl">5</dd>
              </div>
            </dl>
          </Card>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <SectionHeading
            eyebrow="Who it is for"
            title="A professional surface for Social-to-Earn."
            description="The landing experience is designed for brands, creators, and operators evaluating the product — not as a novelty crypto splash page."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map((item) => (
              <Card key={item.title}>
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-border bg-surface py-20">
        <Container>
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Campaigns"
              title="A preview of the marketplace."
              description="Cards below use isolated sample data so layout, density, and copy can be judged without a database."
            />
            <Button href="/campaigns" variant="secondary">
              Browse all samples
            </Button>
          </div>
          <SampleDataNotice />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {featured.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <SectionHeading
            eyebrow="Flow"
            title="Simple now. Strict later."
            description="Phase 1 explains the loop without pretending verification or payments already exist."
          />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step.title}>
                <p className="font-mono text-sm text-accent">0{index + 1}</p>
                <h3 className="mt-3 font-display text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
              </Card>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}
