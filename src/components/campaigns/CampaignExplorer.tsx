"use client";

import { useMemo, useState } from "react";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import {
  platformLabel,
  type SampleCampaign,
  type SocialPlatform,
} from "@/data/sample-campaigns";

const filters: Array<"all" | SocialPlatform> = [
  "all",
  "x",
  "instagram",
  "tiktok",
  "youtube",
];

export function CampaignExplorer({
  campaigns,
}: {
  campaigns: SampleCampaign[];
}) {
  const [platform, setPlatform] = useState<(typeof filters)[number]>("all");

  const visible = useMemo(() => {
    if (platform === "all") return campaigns;
    return campaigns.filter((campaign) =>
      campaign.platforms.includes(platform),
    );
  }, [campaigns, platform]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Platform filter">
        {filters.map((filter) => {
          const selected = platform === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setPlatform(filter)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {filter === "all" ? "All platforms" : platformLabel[filter]}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No sample campaigns match this filter.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visible.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
