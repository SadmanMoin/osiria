import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  platformLabel,
  statusLabel,
  type SampleCampaign,
} from "@/data/sample-campaigns";

function statusTone(status: SampleCampaign["status"]) {
  if (status === "open") return "teal" as const;
  if (status === "filling") return "accent" as const;
  return "warn" as const;
}

export function CampaignCard({ campaign }: { campaign: SampleCampaign }) {
  const filled = campaign.totalSlots - campaign.remainingSlots;
  const progress = Math.round((filled / campaign.totalSlots) * 100);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{campaign.brand}</p>
          <h3 className="mt-1 font-display text-xl tracking-tight">
            {campaign.title}
          </h3>
        </div>
        <Badge tone={statusTone(campaign.status)}>
          {statusLabel[campaign.status]}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{campaign.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {campaign.platforms.map((platform) => (
          <Badge key={platform}>{platformLabel[platform]}</Badge>
        ))}
        <Badge>{campaign.category}</Badge>
      </div>
      <p className="mt-5 text-sm text-foreground">{campaign.taskSummary}</p>
      <div className="mt-auto pt-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>{campaign.rewardLabel}</span>
          <span>
            {campaign.remainingSlots} of {campaign.totalSlots} slots left
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
