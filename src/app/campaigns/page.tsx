import type { Metadata } from "next";
import { CampaignExplorer } from "@/components/campaigns/CampaignExplorer";
import { Container } from "@/components/ui/Container";
import { SampleDataNotice } from "@/components/ui/SampleDataNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { sampleCampaigns } from "@/data/sample-campaigns";

export const metadata: Metadata = {
  title: "Campaigns",
  description:
    "Preview sample Social-to-Earn campaigns. These records are static UI data, not a live marketplace.",
};

export default function CampaignsPage() {
  return (
    <Container className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="Marketplace preview"
        title="Campaigns"
        description="Filter the sample set by platform. Joining, submitting proof, and payouts are not available in this phase."
      />
      <div className="mt-8">
        <SampleDataNotice />
      </div>
      <div className="mt-10">
        <CampaignExplorer campaigns={sampleCampaigns} />
      </div>
    </Container>
  );
}
